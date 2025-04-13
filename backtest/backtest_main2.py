import json
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

# CSV file to store trade results
csv_file = "backtest_trade_results.csv"
with open(csv_file, mode='w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow([
        "Timestamp", "PHT Time", "Session", "Position", "Entry", "Stop Loss",
        "Stage", "PnL (%)", "VWAP", "Trendline", "Mean Close", "High", "Low", "RSI"
    ])

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
    pht_time_str = pht_time.strftime("%Y-%m-%d %H:%M:%S")

    # Get active trading sessions
    active_sessions = get_active_sessions(timestamp)

    # Reset session data when a session ends
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

    # Save session data to CSV
    with open(csv_file, mode='a', newline='') as file:
        writer = csv.writer(file)
        for session in active_sessions:
            highest_high, lowest_low = high_low_values.get(session, (None, None))
            writer.writerow([
                timestamp,
                pht_time_str,
                session,
                position if position is not None else "",
                entry_value if entry_value is not None else "",
                stop_loss if stop_loss is not None else "",
                stage,
                "",  # PnL calculation if available
                round(vwap_values.get(session, 0), 2) if vwap_values.get(session) is not None else "",
                str(trendline_values.get(session, "(0, 0)")),
                round(mean_close_values.get(session, 0), 2) if mean_close_values.get(session) is not None else "",
                round(highest_high, 2) if highest_high is not None else "",
                round(lowest_low, 2) if lowest_low is not None else "",
                round(rsi_value, 2) if rsi_value is not None else ""
            ])
