import json
import numpy as np
from datetime import datetime

from kline_utils import get_kline_data

# Load data from a JSON file
def load_data_from_file(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    return data

# Function to determine active trading sessions (handling overlaps)
def get_active_sessions(timestamp):
    utc_time = datetime.utcfromtimestamp(timestamp / 1000)  # Convert milliseconds to seconds
    hour = utc_time.hour

    active_sessions = []

    if 22 <= hour or hour < 6:
        active_sessions.append("Sydney")
    if 0 <= hour < 8:
        active_sessions.append("Tokyo")
    if 7 <= hour < 15:
        active_sessions.append("London")
    if 13 <= hour < 21:
        active_sessions.append("New York")

    return active_sessions

# VWAP Calculation
def get_vwap(kline_data):
    numerator = 0
    denominator = 0
    
    for kline in kline_data:
        close_price = float(kline[4])  # close price
        volume = float(kline[5])  # volume
        numerator += close_price * volume
        denominator += volume
    
    return numerator / denominator if denominator != 0 else 0

# Trendline Calculation
def calculate_trendline_slope(kline_data):
    try:
        if len(kline_data) < 2:  # Need at least two points for a trendline
            return 0, 0

        # Extract timestamps and closing prices
        timestamps = np.array([int(entry[0]) for entry in kline_data])
        closing_prices = np.array([float(entry[4]) for entry in kline_data])

        # Normalize timestamps for numerical stability
        timestamps_normalized = timestamps - timestamps[0]

        # Perform linear regression
        A = np.vstack([timestamps_normalized, np.ones_like(timestamps_normalized)]).T
        slope, intercept = np.linalg.lstsq(A, closing_prices, rcond=None)[0]

        return slope, intercept
    except Exception as e:
        return {"error": str(e)}

# Mean Close Calculation
def calculate_mean_close(kline_data):
    try:
        closing_prices = [float(candle[4]) for candle in kline_data]
        mean_close = sum(closing_prices) / len(closing_prices) if closing_prices else None
        return mean_close
    except Exception as e:
        return {"error": str(e)}

# Highest High & Lowest Low Calculation
def get_highest_high_lowest_low(kline_data):
    try:
        highs = [float(candle[2]) for candle in kline_data]
        lows = [float(candle[3]) for candle in kline_data]
        
        highest_high = max(highs) if highs else None
        lowest_low = min(lows) if lows else None

        return highest_high, lowest_low
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    kline_session_data = get_kline_data(symbol='PEAQUSDT', interval=5, start=1738454400000, end=1738486800000)
    print(calculate_mean_close(kline_session_data))

# Initialize data tracking for each session
# session_data = {
#     "Sydney": [],
#     "Tokyo": [],
#     "London": [],
#     "New York": []
# }

# # Load historical data
# file_path = 'backtest/historical_klines/BTCUSDT_5m_historical_data.json'
# data = load_data_from_file(file_path)

# # Loop through the historical data
# for kline in data:
#     timestamp, open_price, high, low, close, volume, quote_volume = kline
#     timestamp = int(timestamp)
#     open_price = float(open_price)
#     high = float(high)
#     low = float(low)
#     close = float(close)
#     volume = float(volume)
#     quote_volume = float(quote_volume)

#     # Get active trading sessions
#     active_sessions = get_active_sessions(timestamp)

#     # Reset session data when a session ends
#     for session in session_data.keys():
#         if session not in active_sessions:
#             session_data[session] = []

#     # Add kline data to active sessions
#     for session in active_sessions:
#         session_data[session].append(kline)

#     # Compute VWAP, Trendline, Mean Close, Highest High & Lowest Low for active sessions
#     vwap_values = {session: get_vwap(session_data[session]) for session in active_sessions}
#     trendline_values = {session: calculate_trendline_slope(session_data[session]) for session in active_sessions}
#     mean_close_values = {session: calculate_mean_close(session_data[session]) for session in active_sessions}
#     high_low_values = {session: get_highest_high_lowest_low(session_data[session]) for session in active_sessions}

#     # Print results
#     print(f"Timestamp: {timestamp}, Open: {open_price}, High: {high}, Low: {low}, Close: {close}, Volume: {volume}")
#     print(f"Active Trading Sessions: {', '.join(active_sessions)}")

#     for session in active_sessions:
#         vwap = vwap_values[session]
#         slope, intercept = trendline_values[session]
#         mean_close = mean_close_values[session]
#         highest_high, lowest_low = high_low_values[session]
        
#         print(f"{session} VWAP: {vwap:.2f}, Trendline Slope: {slope:.6f}, Intercept: {intercept:.2f}, Mean Close: {mean_close:.2f}")
#         print(f"{session} Highest High: {highest_high:.2f}, Lowest Low: {lowest_low:.2f}")
    
#     print("-" * 50)
