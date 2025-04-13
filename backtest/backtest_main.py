import json
import time
import numpy as np
import csv
from datetime import datetime

from backtest_functions import (
    RSI_Calculator,
    calculate_mean_close,
    calculate_trendline_slope,
    convert_to_pht,
    get_active_sessions,
    get_highest_high_lowest_low,
    get_vwap,
    load_data_from_file,
)

# Initialize session data storage
session_data = {
    "Sydney": [],
    "Tokyo": [],
    "London": [],
    "New York": [],
}

# Load historical data
file_path = "backtest/historical_klines/BTCUSDT_5m_historical_data.json"
data = load_data_from_file(file_path)

# Initialize RSI Calculator
rsi_calculator = RSI_Calculator(period=14)

# Initialize trade tracking variables
position = None  # 'long', 'short', or None
entry_value = None
stop_loss = None
stage = 0
last_mean_close = {
    "Sydney": None,
    "Tokyo": None,
    "London": None,
    "New York": None,
}

# CSV file to store trade results
csv_file = "backtest_trade_results.csv"
with open(csv_file, mode='w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(["Position", "Entry", "Stop Loss", "Stage", "PnL (%)"])

# Loop through the historical data
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

    # Get active trading sessions
    active_sessions = get_active_sessions(timestamp)

    # Reset session data when a session ends
    for session in session_data.keys():
        if session not in active_sessions:
            last_mean_close[session] = mean_close_values[session]
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

    # --- STOP LOSS CHECK ---
    if position == "long" and close <= stop_loss:
        pnl_percentage = ((close - entry_value) / entry_value) * 100

        # Ensure loss is negative
        if close < entry_value:
            pnl_percentage = -abs(pnl_percentage)

        print(f"❌ LONG Stopped Out! PnL: {pnl_percentage:.2f}%")

        # Save to CSV
        with open(csv_file, mode='a', newline='') as file:
            writer = csv.writer(file)
            writer.writerow([position, entry_value, close, stage, pnl_percentage])

        # Reset trade
        position = None
        entry_value = None
        stop_loss = None
        stage = 0

    elif position == "short" and close >= stop_loss:
        pnl_percentage = ((entry_value - close) / entry_value) * 100

        # Ensure loss is negative
        if close > entry_value:
            pnl_percentage = -abs(pnl_percentage)

        print(f"❌ SHORT Stopped Out! PnL: {pnl_percentage:.2f}%")

        # Save to CSV
        with open(csv_file, mode='a', newline='') as file:
            writer = csv.writer(file)
            writer.writerow([position, entry_value, close, stage, pnl_percentage])

        # Reset trade
        position = None
        entry_value = None
        stop_loss = None
        stage = 0


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

            # Save to CSV
            with open(csv_file, mode='a', newline='') as file:
                writer = csv.writer(file)
                writer.writerow([position, entry_value, close, stage, pnl_percentage])

            # Reset trade
            position = None
            entry_value = None
            stop_loss = None
            stage = 0

    # --- TRADE ENTRY LOGIC AT 10:00 AM PHT ---
    if pht_hour == 10 and pht_minute == 0:
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

    if stage == 1 and "Sydney" not in active_sessions:
        if "Sydney" in mean_close_values and mean_close_values["Sydney"] is not None:
            stop_loss = mean_close_values["Sydney"]
            stage = 2
            print('checking value', stop_loss)
            time.sleep(20)

    if stage == 2 and "London" in active_sessions:
        stage = 3

    # --- MOVE TO STAGE 4 WHEN TOKYO SESSION ENDS ---
    if stage == 3 and "Tokyo" not in active_sessions:
        if "Tokyo" in mean_close_values and mean_close_values["Tokyo"] is not None:
            stop_loss = mean_close_values["Tokyo"]  # Update stop-loss to Tokyo's mean close
            stage = 4
            print(f"🔄 Stage 4: Updated SL to {stop_loss:.2f}")

    if stage == 4 and "London" not in active_sessions:
        stop_loss = mean_close_values["London"]
    
    if stage == 5 and "New York" not in active_sessions:
        stop_loss = mean_close_values["New York"]

        if (position == "long" and rsi_value >= 70) or (position == "short" and rsi_value <= 30):
            pnl_percentage = ((close - entry_value) / entry_value) * 100 if position == "long" else ((entry_value - close) / entry_value) * 100

            # Ensure loss is negative
            if (position == "long" and close < entry_value) or (position == "short" and close > entry_value):
                pnl_percentage = -abs(pnl_percentage)

            print(f"✅ Trade Closed by RSI! PnL: {pnl_percentage:.2f}%")

            # Save to CSV
            with open(csv_file, mode='a', newline='') as file:
                writer = csv.writer(file)
                writer.writerow([position, entry_value, close, stage, pnl_percentage])

            # Reset trade
            position = None
            entry_value = None
            stop_loss = None
            stage = 0



    # Print trade status if a position is active
    if position:
        print(f"📌 Current Position: {position.upper()}, Entry: {entry_value:.2f}, SL: {stop_loss:.2f}, Stage: {stage}")