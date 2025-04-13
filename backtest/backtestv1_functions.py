import json
from datetime import datetime, timezone, timedelta
import numpy as np
import csv
import re
import os

def get_file_paths(folder_path: str) -> list:
    """
    Retrieves all file paths from the given folder.
    
    :param folder_path: str, the input folder path
    :return: list, a list of file paths
    """
    return [os.path.join(folder_path, file) for file in os.listdir(folder_path) if os.path.isfile(os.path.join(folder_path, file))]

def extract_trading_pair(file_path: str) -> str:
    """
    Extracts the trading pair from a given file path string, ensuring numbers at the start are included.
    
    :param file_path: str, the input file path
    :return: str, the extracted trading pair
    """
    match = re.search(r'(\d*[A-Z]+USDT)', file_path)
    return match.group(1) if match else None


def log_trade_result(is_win, pnl_percentage_after_fee, tally_data):
    # Append to a CSV file with the trade result and running PnL
    with open('trade_results.csv', mode='a', newline='') as file:
        writer = csv.writer(file)
        writer.writerow([is_win, pnl_percentage_after_fee, tally_data['wins'], tally_data['losses']])
        
    # Update the tally counters
    if is_win:
        tally_data['wins'] += 1
    else:
        tally_data['losses'] += 1
    
    # Print the updated tally
    print(f"Tally - Wins: {tally_data['wins']}, Losses: {tally_data['losses']}")

# Add headers to the CSV file if it's empty
def initialize_csv():
    try:
        with open('trade_results.csv', mode='r') as file:
            pass  # File exists, no need to write headers
    except FileNotFoundError:
        with open('trade_results.csv', mode='w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(['Win/Loss', 'PnL %', 'Wins Tally', 'Losses Tally'])
            
def get_highest_high(candles, count):
    """Get the highest high from the last 'count' closed candles."""
    return max(float(candle[2]) for candle in candles[-count:])

def get_lowest_low(candles, count):
    """Get the lowest low from the last 'count' closed candles."""
    return min(float(candle[3]) for candle in candles[-count:])

def get_bollinger_bands(klines, period=20, num_std_dev=2):
    period = int(period)  # Ensure period is an integer
    """Calculate the Bollinger Bands for the given kline data."""
    if len(klines) < period:
        return None  # Not enough data for Bollinger Bands

    closing_prices = [float(kline[4]) for kline in klines]
    sma = np.mean(closing_prices[-period:])  # Simple Moving Average (SMA)
    std_dev = np.std(closing_prices[-period:], ddof=1)  # Sample standard deviation

    upper_band = sma + num_std_dev * std_dev
    lower_band = sma - num_std_dev * std_dev

    
    return float(upper_band), float(lower_band)

def get_bollinger_bands_width(kline_data, period=20):
    """
    Computes the latest Bollinger Bands Width (BBW) from kline data.

    :param kline_data: list - The kline data containing candlesticks with closing prices.
    :param period: int - The number of periods for the moving average and standard deviation. Default is 20.
    :return: float - The latest BBW value.
    """
    try:
        # Extract closing prices from kline data
        closing_prices = [float(candle[4]) for candle in kline_data]

        if len(closing_prices) < period:
            raise ValueError("Insufficient data to calculate Bollinger Bands.")

        # Use the latest period of closing prices
        window = closing_prices[-period:]
        sma = np.mean(window)  # Simple Moving Average
        std_dev = np.std(window)  # Standard Deviation

        upper_band = sma + 2 * std_dev
        lower_band = sma - 2 * std_dev
        bbw_value = (upper_band - lower_band) / sma

        return bbw_value
    except Exception as e:
        return {"error": str(e)}

def get_atr(klines, period=14):
    """
    Computes the Average True Range (ATR) for given kline data.

    :param klines: list - Kline data where each entry is 
                           [timestamp, open, high, low, close, volume, quote_volume].
    :param period: int - The number of periods for the ATR calculation. Default is 14.
    :return: float - The latest ATR value or None if not enough data.
    """
    if len(klines) < period + 1:
        return None  # Not enough data

    try:
        high_prices = [float(kline[2]) for kline in klines]
        low_prices = [float(kline[3]) for kline in klines]
        close_prices = [float(kline[4]) for kline in klines]

        true_ranges = []

        for i in range(1, len(klines)):
            high_low = high_prices[i] - low_prices[i]
            high_prev_close = abs(high_prices[i] - close_prices[i - 1])
            low_prev_close = abs(low_prices[i] - close_prices[i - 1])

            # True range is the maximum of these three values
            tr = max(high_low, high_prev_close, low_prev_close)
            true_ranges.append(tr)

        # Compute ATR using the last `period` values
        atr = sum(true_ranges[-period:]) / period
        return float(atr)
    except Exception:
        return None  # Handle errors gracefully


def get_market_trendline_slope(kline_data):
    """
    Calculate the normalized trendline slope using linear regression.
    
    Args:
        kline_data (list): List of kline data where each entry is 
                           [timestamp, open, high, low, close, volume, quote_volume].
    
    Returns:
        float: Normalized slope between -1 and 1, or None if not enough data.
    """
    try:
        if len(kline_data) < 2:  # Need at least 2 points for a trendline
            return None

        closing_prices = np.array([float(entry[4]) for entry in kline_data])
        timestamps = np.arange(len(closing_prices))  # Use relative indices for timestamps

        # Linear regression for trendline slope
        A = np.vstack([timestamps, np.ones_like(timestamps)]).T
        slope, _ = np.linalg.lstsq(A, closing_prices, rcond=None)[0]

        # Normalize slope to be between -1 and 1 using the range of closing prices
        max_price_range = np.ptp(closing_prices)  # Peak-to-peak (max - min) of prices
        normalized_slope = slope / max_price_range if max_price_range != 0 else 0

        return round(max(-1, min(1, normalized_slope)), 4)  # Clamp to [-1, 1] and round to 4 decimal places
    except Exception:
        return None


def get_vwap(kline_data):
    """
    Calculates the VWAP (Volume Weighted Average Price) for a given kline data.

    :param kline_data: List of lists, where each list contains 
                       [timestamp, open, high, low, close, volume, quote_volume]
    :return: VWAP value as float or None if there's no valid data
    """
    numerator = 0.0
    denominator = 0.0

    for kline in kline_data:
        try:
            close_price = float(kline[4])  # Close price
            volume = float(kline[5])  # Volume
            numerator += close_price * volume
            denominator += volume
        except (ValueError, IndexError):
            continue  # Skip invalid data

    return round(numerator / denominator, 2) if denominator > 0 else None


def get_rsi(data, period=12):
    if len(data) < period:
        return None  # Not enough data to compute RSI

    try:
        closing_prices = np.array([float(entry[4]) for entry in data])  # Extract close prices
        price_changes = np.diff(closing_prices)  # Calculate price changes

        gains = np.where(price_changes > 0, price_changes, 0)
        losses = np.where(price_changes < 0, -price_changes, 0)

        avg_gain = np.mean(gains[:period])
        avg_loss = np.mean(losses[:period])

        for i in range(period, len(gains)):
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period

        if avg_loss == 0:
            return 100.0  # If no losses, RSI is 100
        else:
            rs = avg_gain / avg_loss
            return round(100 - (100 / (1 + rs)), 2)  # Return latest RSI as float
    except Exception as e:
        return None  # Return None if any error occurs

def get_active_sessions(timestamp):
    pht_time = datetime.fromtimestamp(timestamp / 1000, timezone.utc) + timedelta(hours=8)  # Convert to PHT
    hour = pht_time.hour

    active_sessions = []

    # Sydney: 5 AM - 2 PM PHT (05:00 - 14:59)
    if 5 <= hour < 15:
        active_sessions.append("sydney")

    # Tokyo: 8 AM - 5 PM PHT (08:00 - 16:59)
    if 8 <= hour < 17:
        active_sessions.append("tokyo")

    # London: 3 PM - 12 AM PHT (15:00 - 23:59)
    if 15 <= hour < 24:
        active_sessions.append("london")

    # New York: 9 PM - 6 AM PHT (21:00 - 05:59)
    if 21 <= hour or hour < 6:
        active_sessions.append("ny")

    return active_sessions

def convert_to_pht(timestamp):
    # Ensure timestamp is in seconds (convert from milliseconds if necessary)
    if timestamp > 1e10:  # If timestamp is too large, it's in milliseconds
        timestamp /= 1000  

    # Convert timestamp (assumed to be in seconds) to UTC datetime
    utc_time = datetime.utcfromtimestamp(timestamp)

    # Convert UTC to PHT (UTC+8)
    pht_time = utc_time + timedelta(hours=8)

    return pht_time  # Return datetime object instead of string

def load_data_from_file(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    return data

def get_mean_close(kline_data):
    try:
        closing_prices = [float(candle[4]) for candle in kline_data]
        mean_close = sum(closing_prices) / len(closing_prices) if closing_prices else None
        return mean_close
    except Exception as e:
        return {"error": str(e)}

def get_highest_high_lowest_low(kline_data):
    try:
        highs = [float(candle[2]) for candle in kline_data]
        lows = [float(candle[3]) for candle in kline_data]
        
        highest_high = max(highs) if highs else None
        lowest_low = min(lows) if lows else None

        return highest_high, lowest_low
    except Exception as e:
        return {"error": str(e)}
