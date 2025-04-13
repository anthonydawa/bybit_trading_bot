import json
import numpy as np
from datetime import datetime# Load data from a JSON file
import json
import numpy as np
from datetime import datetime, timezone, timedelta
import csv

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

def load_data_from_file(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    return data
def convert_to_pht(timestamp):
    # Ensure timestamp is in seconds (convert from milliseconds if necessary)
    if timestamp > 1e10:  # If timestamp is too large, it's in milliseconds
        timestamp /= 1000  

    # Convert timestamp (assumed to be in seconds) to UTC datetime
    utc_time = datetime.utcfromtimestamp(timestamp)

    # Convert UTC to PHT (UTC+8)
    pht_time = utc_time + timedelta(hours=8)

    return pht_time  # Return datetime object instead of string


# Function to determine active trading sessions (handling overlaps)
def get_active_sessions(timestamp):
    pht_time = datetime.fromtimestamp(timestamp / 1000, timezone.utc) + timedelta(hours=8)  # Convert to PHT
    hour = pht_time.hour

    active_sessions = []

    # Sydney: 5 AM - 2 PM PHT (21:00 UTC - 05:59 UTC)
    if 21 <= hour or hour < 6:
        active_sessions.append("Sydney")

    # Tokyo: 8 AM - 5 PM PHT (00:00 UTC - 08:59 UTC)
    if 0 <= hour < 9:
        active_sessions.append("Tokyo")

    # London: 3 PM - 12 AM PHT (07:00 UTC - 23:59 UTC)
    if 7 <= hour or hour == 0:
        active_sessions.append("London")

    # New York: 9 AM - 6 PM PHT (01:00 UTC - 09:59 UTC)
    if 1 <= hour < 10:
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
        if len(kline_data) < 2:
            return 0, 0

        timestamps = np.array([int(entry[0]) for entry in kline_data])
        closing_prices = np.array([float(entry[4]) for entry in kline_data])

        timestamps_normalized = timestamps - timestamps[0]

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

# Dynamic RSI Calculation
class RSI_Calculator:
    def __init__(self, period=14):
        self.period = period
        self.closing_prices = []
        self.gains = []
        self.losses = []
        self.rsi_value = None

    def add_data(self, price):
        # Append new closing price
        self.closing_prices.append(price)

        # Calculate price change
        if len(self.closing_prices) > 1:
            change = self.closing_prices[-1] - self.closing_prices[-2]
            if change > 0:
                self.gains.append(change)
                self.losses.append(0)
            else:
                self.gains.append(0)
                self.losses.append(-change)

        # Keep the size of gains and losses equal to the period
        if len(self.gains) > self.period:
            self.gains.pop(0)
            self.losses.pop(0)

        if len(self.gains) == self.period:
            avg_gain = np.mean(self.gains)
            avg_loss = np.mean(self.losses)

            # Calculate the RSI
            if avg_loss == 0:
                self.rsi_value = 100
            else:
                rs = avg_gain / avg_loss
                self.rsi_value = 100 - (100 / (1 + rs))

        return self.rsi_value
