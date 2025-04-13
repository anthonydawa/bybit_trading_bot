from pybit.unified_trading import HTTP
import time
import json
import os
from datetime import datetime


# Initialize session
session = HTTP()

def get_kline_data(symbol, interval, category="linear", until=None):
    """
    Fetches all historical kline (candlestick) data for a given symbol and interval,
    and saves it to a dynamically named file.

    :param symbol: str - The trading pair symbol, e.g., "BTCUSDT".
    :param interval: int - The time interval for the kline data, e.g., 5 (minutes).
    :param category: str - The trading category, default is "linear".
    :param until: str or None - Fetch data until this date (inclusive), in "MM/DD/YYYY" format.
    :return: None
    """
    try:
        # Generate the filename based on symbol and timeframe
        output_file = f"backtest/historical_klines/{symbol}_{interval}m_historical_data.json"
        print(f"Fetching data for {symbol} with interval {interval} minutes...")

        # Check if the file exists and clear it if needed
        if os.path.exists(output_file):
            print(f"Clearing existing file: {output_file}")
            os.remove(output_file)

        all_klines = []
        params = {
            "category": category,
            "symbol": symbol,
            "interval": interval,
            "limit": 300
        }

        # Convert 'until' argument to a timestamp in milliseconds, if provided
        until_timestamp = None
        if until:
            until_datetime = datetime.strptime(until, "%m/%d/%Y")
            until_timestamp = int(until_datetime.timestamp() * 1000)
            print(f"Fetching data until: {until_datetime} (timestamp: {until_timestamp})")

        # Get the latest data to determine the most recent timestamp
        while True:
            response = session.get_kline(**params)
            
            # Check if the response is valid
            if "result" not in response or "list" not in response["result"] or not response["result"]["list"]:
                print(f"No more data available for {symbol}. Exiting loop.")
                break
            
            klines = response["result"]["list"]
            all_klines.extend(klines)
            print(f"Fetched {len(klines)} records for {symbol}. Total records so far: {len(all_klines)}")
            
            # Get the timestamp of the oldest kline
            last_timestamp = int(klines[-1][0])  # Start time of the last candle
            
            # Check if we've reached the 'until' limit
            if until_timestamp and last_timestamp < until_timestamp:
                print(f"Reached the 'until' limit. Stopping data fetch.")
                break
            
            # Update the end timestamp for the next batch
            params["end"] = last_timestamp - 1
            
            # Avoid hitting rate limits
            time.sleep(0.1)
        
        # Reverse the data to chronological order
        all_klines.reverse()

        # Save to a file
        with open(output_file, "w") as f:
            json.dump(all_klines, f)
        
        print(f"Data for {symbol} saved to {output_file}. Total records: {len(all_klines)}")
    except Exception as e:
        print(f"Error fetching data for {symbol}: {str(e)}")


def get_all_market_data(filename, interval, category="linear"):
    """
    Fetches historical kline data for all markets listed in the given JSON file.

    :param filename: str - The file containing the list of market symbols.
    :param interval: int - The time interval for the kline data, e.g., 5 (minutes).
    :param category: str - The trading category, default is "linear".
    :return: None
    """
    try:
        # Load the market symbols from the JSON file
        with open(filename, "r") as f:
            markets = json.load(f)
        
        # Iterate over each market and fetch its data
        for market in markets:
            print(f"Starting data fetch for market: {market}")
            get_kline_data(market, interval, category)
            print(f"Completed data fetch for market: {market}\n")
    except Exception as e:
        print(f"Error processing markets from {filename}: {str(e)}")


# Example usage
if __name__ == "__main__":

    json_file_path = "usdt_markets.json"

    with open(json_file_path, "r") as file:
        trading_pairs = json.load(file)

    interval = 5 

    # Loop through trading pairs
    for trading_pair in trading_pairs:
        try:
            get_kline_data(trading_pair, interval, until="2/1/2025")
        except:
            pass        


    # get_kline_data("MYRIAUSDT", 5, until="12/15/2023")                                       