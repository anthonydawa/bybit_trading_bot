import json
import csv
from pybit.unified_trading import HTTP
import numpy as np
import pandas as pd
import os
from datetime import datetime

# Initialize session
session = HTTP()

def get_kline_data(symbol, interval, category="linear", start=None, end=None):
    try:
        params = {
            "category": category,
            "symbol": symbol,
            "interval": interval,
            "limit": 300
        }
        if start:
            params["start"] = start
        if end:
            params["end"] = end

        response = session.get_kline(**params)
        return response['result']['list'][::-1]  # Reverse list to chronological order
    except Exception as e:
        return {"error": str(e)}

def compute_rsi(data, period=12):
    if len(data) < period:
        return {"error": "Not enough data to compute RSI"}

    try:
        closing_prices = [float(entry[4]) for entry in data]
        price_changes = np.diff(closing_prices)
        gains = np.where(price_changes > 0, price_changes, 0)
        losses = np.where(price_changes < 0, -price_changes, 0)

        avg_gain = np.mean(gains[:period])
        avg_loss = np.mean(losses[:period])

        rsi_list = []
        for i in range(period, len(gains)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period

            if avg_loss == 0:
                rsi = 100
            else:
                rs = avg_gain / avg_loss
                rsi = 100 - (100 / (1 + rs))
            rsi_list.append(rsi)

        return rsi_list
    except Exception as e:
        return {"error": str(e)}

def check_rsi_levels(symbol, interval, start, end, category="linear", period=12):
    try:
        kline_data = get_kline_data(symbol, interval, category, start=start, end=end)
        if "error" in kline_data:
            return kline_data["error"]
        if len(kline_data) < period:
            return "Not enough data for RSI calculation"

        rsi_values = compute_rsi(kline_data, period)
        if "error" in rsi_values:
            return rsi_values["error"]

        above_70 = any(rsi > 70 for rsi in rsi_values)
        below_30 = any(rsi < 30 for rsi in rsi_values)

        if above_70 and below_30:
            return "both"
        elif above_70:
            return "overbought"
        elif below_30:
            return "oversold"
        else:
            return "none"
    except Exception as e:
        return {"error": str(e)}

def evaluate_sessions(interval, category="linear", period=12, market=None):
    """
    Evaluates RSI levels for each session in sessions.json.

    :param interval: int - Time interval for kline data in minutes.
    :param category: str - Trading category (default: "linear").
    :param period: int - RSI lookback period (default: 14).
    :param market: str (optional) - Specific market to evaluate. If None, evaluates all markets.
    :return: dict - Results for each session.
    """
    # Load sessions from file
    with open('sessions.json', 'r') as file:
        sessions = json.load(file)

    # Load USDT markets from file
    with open('usdt_markets.json', 'r') as file:
        usdt_markets = json.load(file)

    # Determine the markets to evaluate
    if market:
        # If a specific market is provided, use it
        markets_to_check = [market]
    else:
        # If no specific market is provided, use all markets
        markets_to_check = usdt_markets

    # Prepare the CSV file to save results
    with open('rsi_evaluation_results.csv', 'w', newline='') as csvfile:
        fieldnames = ['Market', 'Session', 'RSI Level']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

        # Write header
        writer.writeheader()

        # Loop through all markets to evaluate
        for market in markets_to_check:
            print(f"Evaluating market: {market}")  # Print current market being processed
            
            # Loop through all sessions
            for session_name, times in sessions.items():
                print(f"  Checking session: {session_name}")  # Print current session being processed
                
                start_epoch = times["start_epoch"]
                end_epoch = times["end_epoch"]

                result = check_rsi_levels(market, interval, start_epoch, end_epoch, category, period)

                # Save result in CSV
                writer.writerow({'Market': market, 'Session': session_name, 'RSI Level': result})

    print("RSI evaluation results saved to 'rsi_evaluation_results.csv'.")


def query_rsi_results(query, market=None, session=None):
    """
    Queries the RSI evaluation results CSV file for markets that are neither oversold nor overbought,
    with optional filters for specific market and session. Saves each query result to a CSV file.
    
    :param query: str - The RSI level to filter by ('oversold', 'overbought', 'both', 'none', 'not_oversold', 'not_overbought', or 'not_oversold_or_overbought').
    :param market: str - Optional. The specific market to filter by. If None, returns all markets.
    :param session: str - Optional. The specific session to filter by. If None, returns all sessions.
    :return: pd.DataFrame - Filtered DataFrame based on query.
    """
    # Load the CSV into a DataFrame
    df = pd.read_csv('rsi_evaluation_results.csv')

    # Query the DataFrame based on the provided query
    if query == 'oversold':
        filtered_df = df[df['RSI Level'] == 'oversold']
    elif query == 'overbought':
        filtered_df = df[df['RSI Level'] == 'overbought']
    elif query == 'both':
        filtered_df = df[df['RSI Level'] == 'both']
    elif query == 'none':
        filtered_df = df[df['RSI Level'] == 'none']
    elif query == 'not_oversold':  # This filters out the oversold markets
        filtered_df = df[df['RSI Level'] != 'oversold']
    elif query == 'not_overbought':  # This filters out the overbought markets
        filtered_df = df[df['RSI Level'] != 'overbought']
    elif query == 'not_oversold_or_overbought':  # This filters out both oversold and overbought markets
        filtered_df = df[~df['RSI Level'].isin(['oversold', 'overbought'])]
    else:
        print("Invalid query. Please use 'oversold', 'overbought', 'both', 'none', 'not_oversold', 'not_overbought', or 'not_oversold_or_overbought'.")
        return None

    # If a specific market is provided, filter for that market
    if market:
        filtered_df = filtered_df[filtered_df['Market'] == market]

    # If a specific session is provided, filter for that session
    if session:
        filtered_df = filtered_df[filtered_df['Session'] == session]

    # Save the filtered results to a CSV file
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_filename = f"rsi_query_results_{query}_{timestamp}.csv"
    filtered_df.to_csv(output_filename, index=False)

    # Print the filtered results and notify about the saved file
    print(f"Filtered RSI results for '{query}' with market '{market if market else 'all markets'}' and session '{session if session else 'all sessions'}':")
    print(filtered_df)
    print(f"Results have been saved to '{output_filename}'")

    return filtered_df

# Example usage


if __name__ == "__main__":


    interval = 5  # 5-minute intervals
    market = None  # Pass a specific market here if needed, or leave as None to evaluate all markets
    evaluate_sessions(interval, market=market)

    # Query for markets that are neither oversold nor overbought, with a specific market
    # query_rsi_results('not_oversold', session=['sydney',['']])  

    # Query for all markets that are neither oversold nor overbought
    # query_rsi_results('not_oversold_or_overbought')
