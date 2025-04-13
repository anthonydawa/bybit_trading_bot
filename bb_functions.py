import json
from datetime import datetime, timezone, timedelta
import numpy as np
import csv
import re
import os

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


