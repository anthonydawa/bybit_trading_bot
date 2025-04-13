# import numpy as np
# import json
# import csv
# from pybit.unified_trading import HTTP

# session = HTTP()

# def get_market_trendline_slope(kline_data):
#     """
#     Calculate the trendline slope using linear regression on kline data.
    
#     Args:
#         kline_data (list): List of kline data where each entry is [timestamp, open, high, low, close, volume].
    
#     Returns:
#         float: Slope of the trendline.
#     """
#     try:
#         timestamps = np.array([int(entry[0]) for entry in kline_data])
#         closing_prices = np.array([float(entry[4]) for entry in kline_data])

#         # Normalize timestamps for numerical stability
#         timestamps_normalized = timestamps - timestamps[0]

#         # Linear regression for trendline slope
#         A = np.vstack([timestamps_normalized, np.ones_like(timestamps_normalized)]).T
#         slope, _ = np.linalg.lstsq(A, closing_prices, rcond=None)[0]

#         return slope
#     except Exception as e:
#         return {"error": str(e)}


# def fetch_kline_data(symbol, interval, start, end):
#     """
#     Fetch kline data for a given market symbol and session.
    
#     Args:
#         symbol (str): Trading market symbol.
#         interval (str): Kline interval.
#         start (int): Start timestamp in milliseconds.
#         end (int): End timestamp in milliseconds.
    
#     Returns:
#         list: Kline data or error message if retrieval fails.
#     """
#     try:
#         print(f"Fetching kline data for market: {symbol}, start: {start}, end: {end}")
#         params = {
#             "category": "linear",
#             "symbol": symbol,
#             "interval": interval,
#             "limit": 300,
#             "start": start,
#             "end": end
#         }
#         response = session.get_kline(**params)
#         return response['result']['list'][::-1]
#     except Exception as e:
#         return {"error": str(e)}


# def calculate_and_save_trendline_slopes(
#     sessions_to_use=None,
#     interval="5", 
#     market_file="usdt_markets.json", 
#     session_file="sessions.json", 
#     output_file="market_trendline_slopes.csv"
# ):
#     """
#     Calculate and save trendline slopes for specified market symbols and trading sessions.
    
#     Args:
#         sessions_to_use (list): List of session names to use (e.g., ['sydney', 'tokyo']). 
#                                 If None, all sessions will be used.
#         interval (str): Kline interval for data fetching.
#         market_file (str): Default path to JSON file containing market symbols.
#         session_file (str): Default path to JSON file containing session times.
#         output_file (str): Default path to save the output CSV file.
#     """
#     print("Loading market symbols and session times...")
#     with open(market_file, "r") as f:
#         market_symbols = json.load(f)

#     with open(session_file, "r") as f:
#         session_times = json.load(f)

#     # Filter sessions if specific sessions are provided
#     if sessions_to_use:
#         session_times = {name: times for name, times in session_times.items() if name in sessions_to_use}

#     results = []

#     print("Starting calculations for each market and session...")
#     # Loop through each market symbol and filtered sessions
#     for symbol in market_symbols:
#         print(f"Processing market: {symbol}")
#         for session_name, times in session_times.items():
#             print(f"  Processing session: {session_name}")
#             start_epoch = times["start_epoch"]
#             end_epoch = times["end_epoch"]

#             kline_data = fetch_kline_data(symbol, interval, start_epoch, end_epoch)

#             if isinstance(kline_data, dict) and "error" in kline_data:
#                 print(f"  Error fetching kline data for {symbol} in {session_name}: {kline_data['error']}")
#                 slope = "N/A"
#             else:
#                 slope = get_market_trendline_slope(kline_data)
#                 if isinstance(slope, dict) and "error" in slope:
#                     print(f"  Error calculating slope for {symbol} in {session_name}: {slope['error']}")
#                     slope = "N/A"
#                 else:
#                     print(f"  Calculated trendline slope for {symbol} in {session_name}: {slope}")

#             # Save the result
#             results.append([symbol, session_name, slope])

#     print(f"Writing results to {output_file}...")
#     # Write results to CSV
#     with open(output_file, "w", newline="") as csvfile:
#         writer = csv.writer(csvfile)
#         writer.writerow(["Market Symbol", "Session", "Trendline Slope"])
#         writer.writerows(results)

#     print(f"Trendline slopes have been successfully saved to {output_file}")


# if __name__ == "__main__":
#     calculate_and_save_trendline_slopes(['sydney', 'tokyo'])
import numpy as np
import json
import csv
from pybit.unified_trading import HTTP

session = HTTP()

def get_market_trendline_slope(kline_data):
    """
    Calculate the normalized trendline slope using linear regression.
    
    Args:
        kline_data (list): List of kline data where each entry is [timestamp, open, high, low, close, volume].
    
    Returns:
        float: Normalized slope between -1 and 1.
    """
    try:
        closing_prices = np.array([float(entry[4]) for entry in kline_data])
        timestamps = np.arange(len(closing_prices))  # Use relative indices for timestamps

        # Linear regression for trendline slope
        A = np.vstack([timestamps, np.ones_like(timestamps)]).T
        slope, intercept = np.linalg.lstsq(A, closing_prices, rcond=None)[0]

        # Normalize slope to be between -1 and 1 using the range of closing prices
        max_price_range = np.ptp(closing_prices)  # Peak to peak (max - min) of prices
        normalized_slope = slope / max_price_range if max_price_range != 0 else 0

        return max(-1, min(1, normalized_slope))  # Clamp to range [-1, 1]
    except Exception as e:
        return {"error": str(e)}


def fetch_kline_data(symbol, interval, start, end):
    """
    Fetch kline data for a given market symbol and session.
    
    Args:
        symbol (str): Trading market symbol.
        interval (str): Kline interval.
        start (int): Start timestamp in milliseconds.
        end (int): End timestamp in milliseconds.
    
    Returns:
        list: Kline data or error message if retrieval fails.
    """
    try:
        print(f"Fetching kline data for market: {symbol}, start: {start}, end: {end}")
        params = {
            "category": "linear",
            "symbol": symbol,
            "interval": interval,
            "limit": 300,
            "start": start,
            "end": end
        }
        response = session.get_kline(**params)
        return response['result']['list'][::-1]
    except Exception as e:
        return {"error": str(e)}


def calculate_and_save_trendline_slopes(
    sessions_to_use=None,
    interval="5", 
    market_file="usdt_markets.json", 
    session_file="sessions.json", 
    output_file="market_trendline_slopes.csv"
):
    """
    Calculate and save trendline slopes for specified market symbols and trading sessions.
    
    Args:
        sessions_to_use (list): List of session names to use (e.g., ['sydney', 'tokyo']). 
                                If None, all sessions will be used.
        interval (str): Kline interval for data fetching.
        market_file (str): Default path to JSON file containing market symbols.
        session_file (str): Default path to JSON file containing session times.
        output_file (str): Default path to save the output CSV file.
    """
    print("Loading market symbols and session times...")
    with open(market_file, "r") as f:
        market_symbols = json.load(f)

    with open(session_file, "r") as f:
        session_times = json.load(f)

    # Filter sessions if specific sessions are provided
    if sessions_to_use:
        session_times = {name: times for name, times in session_times.items() if name in sessions_to_use}

    results = []

    print("Starting calculations for each market and session...")
    # Loop through each market symbol and filtered sessions
    for symbol in market_symbols:
        print(f"Processing market: {symbol}")
        for session_name, times in session_times.items():
            print(f"  Processing session: {session_name}")
            start_epoch = times["start_epoch"]
            end_epoch = times["end_epoch"]

            kline_data = fetch_kline_data(symbol, interval, start_epoch, end_epoch)

            if isinstance(kline_data, dict) and "error" in kline_data:
                print(f"  Error fetching kline data for {symbol} in {session_name}: {kline_data['error']}")
                slope = "N/A"
            else:
                slope = get_market_trendline_slope(kline_data)
                if isinstance(slope, dict) and "error" in slope:
                    print(f"  Error calculating slope for {symbol} in {session_name}: {slope['error']}")
                    slope = "N/A"
                else:
                    print(f"  Calculated trendline slope for {symbol} in {session_name}: {slope}")

            # Save the result
            results.append([symbol, session_name, slope])

    print(f"Writing results to {output_file}...")
    # Write results to CSV
    with open(output_file, "w", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["Market Symbol", "Session", "Trendline Slope"])
        writer.writerows(results)

    print(f"Trendline slopes have been successfully saved to {output_file}")


if __name__ == "__main__":
    calculate_and_save_trendline_slopes(['sydney', 'tokyo'])
