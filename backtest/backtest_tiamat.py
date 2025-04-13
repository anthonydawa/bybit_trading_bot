import csv
from datetime import datetime, timezone, timedelta
import json
import time

from backtest_functions import RSI_Calculator, calculate_mean_close, calculate_trendline_slope, get_highest_high_lowest_low, get_vwap

SYDNEY_START = 5
SYDNEY_END = 14
TOKYO_START = 7
TOKYO_END = 17
LONDON_START = 15
LONDON_END = 24
NY_START = 21
NY_END = 6


# Initialize session data storage
session_data = {
    "Sydney": [],
    "Tokyo": [],
    "London": [],
    "New York": [],
}

last_mean_close = {
    "Sydney": None,
    "Tokyo": None,
    "London": None,
    "New York": None,
}

rsi_calculator = RSI_Calculator(period=9)

# Initialize trade tracking variables
position = None  # 'long', 'short', or None
entry_value = None
stop_loss = None
stage = 0
pnl = 0

def load_data_from_file(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    return data

def convert_to_pht(timestamp):
    if timestamp > 1e10:  # Convert milliseconds to seconds if needed
        timestamp /= 1000  

    utc_time = datetime.utcfromtimestamp(timestamp)
    pht_time = utc_time + timedelta(hours=8)  # Convert UTC to PHT (UTC+8)

    return pht_time  

def get_active_sessions(timestamp):
    pht_time = datetime.fromtimestamp(timestamp / 1000, timezone.utc) + timedelta(hours=8)  
    hour = pht_time.hour

    active_sessions = []

    if SYDNEY_START <= hour < SYDNEY_END:
        active_sessions.append("Sydney")

    if TOKYO_START <= hour < TOKYO_END:
        active_sessions.append("Tokyo")

    if LONDON_START <= hour or hour == 0:  # 15 - 24 PHT (3PM - 12AM)
        active_sessions.append("London")

    if hour >= NY_START or hour < NY_END:  # 21 - 6 PHT (9PM - 6AM)
        active_sessions.append("New York")

    return active_sessions

data = load_data_from_file('backtest/historical_klines/BTCUSDT_5m_historical_data.json')

# Clear the file before starting the loop
with open('backtest/results', mode='w', newline='') as file:
    file.write("")  

# Process data and append results
with open('backtest/results', mode='a', newline='') as file:

    for kline in data:
        timestamp, open_price, high, low, close, volume, quote_volume = kline
        timestamp = int(timestamp)
        open_price = float(open_price)
        high = float(high)
        low = float(low)
        close = float(close)
        volume = float(volume)
        quote_volume = float(quote_volume)

        # Convert timestamp to PHT
        pht_time = convert_to_pht(timestamp)
        pht_hour = pht_time.hour
        pht_minute = pht_time.minute
        active_sessions = get_active_sessions(timestamp)

        for session in session_data.keys():
            if session not in active_sessions:
                session_data[session] = []

        # Add kline data to active sessions
        for session in active_sessions:
            session_data[session].append(kline)

        # Compute VWAP, Trendline, Mean Close, Highest High & Lowest Low for active sessions
        vwap_values = {session: get_vwap(session_data[session]) for session in active_sessions}
        trendline_values = {session: calculate_trendline_slope(session_data[session]) for session in active_sessions}
        mean_close_values = {session: calculate_mean_close(session_data[session]) for session in active_sessions}
        high_low_values = {session: get_highest_high_lowest_low(session_data[session]) for session in active_sessions}

        # Update RSI
        rsi_value = rsi_calculator.add_data(close)

        file.write(f"Timestamp: {timestamp} | PHT Time: {pht_time} | Open: {open_price} | High: {high} | Low: {low} | Close: {close} | Volume: {volume} | Quote Volume: {quote_volume} | Active Sessions: {active_sessions} | VWAP: {vwap_values} | Trendline Slope: {trendline_values} | Mean Close: {mean_close_values} | High-Low: {high_low_values} | RSI: {rsi_value}\n")
        # print(f"Timestamp: {timestamp} | PHT Time: {pht_time} | Open: {open_price} | High: {high} | Low: {low} | Close: {close} | Volume: {volume} | Quote Volume: {quote_volume} | Active Sessions: {active_sessions} | VWAP: {vwap_values} | Trendline Slope: {trendline_values} | Mean Close: {mean_close_values} | High-Low: {high_low_values} | RSI: {rsi_value}\n")
        print(pnl)


        # --- STOP LOSS CHECK ---
        if position == "long" and close <= stop_loss:
            pnl_percentage = ((close - entry_value) / entry_value) * 100

            # Ensure loss is negative
            if close < entry_value:
                pnl_percentage = -abs(pnl_percentage)

            print(f"❌ LONG Stopped Out! PnL: {pnl_percentage:.2f}%")
            print(position,entry_value,close)
            # Reset trade
            position = None
            entry_value = None
            stop_loss = None
            stage = 0
            pnl = pnl + pnl_percentage

        elif position == "short" and close >= stop_loss:
            pnl_percentage = ((entry_value - close) / entry_value) * 100

            # Ensure loss is negative
            if close > entry_value:
                pnl_percentage = -abs(pnl_percentage)

            print(f"❌ SHORT Stopped Out! PnL: {pnl_percentage:.2f}%")
            print(position,entry_value,close)
            # Reset trade
            position = None
            entry_value = None
            stop_loss = None
            stage = 0
            pnl = pnl + pnl_percentage
        # --- TAKE PROFIT LOGIC (STAGE 3 & 4) ---
        if stage >= 3:
            if (position == "long" and rsi_value >= 70) or (position == "short" and rsi_value <= 30):
                # Ensure PnL is negative when trade is a loss
                if position == "long":
                    pnl_percentage = ((close - entry_value) / entry_value) * 100
                else:  # short position
                    pnl_percentage = ((entry_value - close) / entry_value) * 100

                # If trade is a loss, make PnL negative
                if (position == "long" and close < entry_value) or (position == "short" and close > entry_value):
                    pnl_percentage = -abs(pnl_percentage)  # Ensure it's negative

                print(f"✅ Trade Closed by RSI! PnL: {pnl_percentage:.2f}%")

                # Reset trade
                position = None
                entry_value = None
                stop_loss = None
                stage = 0
                pnl = pnl + pnl_percentage

        if pht_hour == 9 and pht_minute == 55:
            if "Sydney" in trendline_values and "Tokyo" in trendline_values:
                sydney_slope, _ = trendline_values["Sydney"]
                tokyo_slope, _ = trendline_values["Tokyo"]

                if sydney_slope > 0 and tokyo_slope > 0:
                    position = "long"
                    entry_value = close
                    stop_loss = high_low_values["Sydney"][1]  # Lowest low of Sydney session
                    stage = 1
                    print(f"🟢 Entered LONG at {entry_value:.2f}, SL: {stop_loss:.2f}")
                elif sydney_slope < 0 and tokyo_slope < 0:
                    position = "short"
                    entry_value = close
                    stop_loss = high_low_values["Sydney"][0]  # Highest high of Sydney session
                    stage = 1
                    print(f"🔴 Entered SHORT at {entry_value:.2f}, SL: {stop_loss:.2f}")
                else:
                    print("No trade entry at 10:00 AM PHT. Market conditions do not align.")

        if stage == 1 and pht_hour == 13 and pht_minute == 55:

            stop_loss = mean_close_values["Sydney"]
            stage = 2
            print('stage and sl updated')
            print(stage,stop_loss)
            # time.sleep(2)

        if stage == 2 and pht_hour == 16 and pht_minute == 55:

            stop_loss = mean_close_values["Tokyo"]
            stage = 3
            print('stage and sl updated')
            print(stage,stop_loss)
            # time.sleep(2)

        if stage == 3 and pht_hour == 23 and pht_minute == 55:

            stop_loss = mean_close_values["London"]
            stage = 4
            print('stage and sl updated')
            print(stage,stop_loss)
            # time.sleep(2)

        if stage == 4 and pht_hour == 23 and pht_minute == 55:

            stop_loss = mean_close_values["New York"]
            stage = 5
            print('stage and sl updated')
            print(stage,stop_loss)
            # time.sleep(2)

        if stage == 5 and pht_hour == 5 and pht_minute == 55:
            print('closed day trade session')
            pass