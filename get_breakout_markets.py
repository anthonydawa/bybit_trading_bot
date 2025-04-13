import csv
import json
from calculate_mean import calculate_mean_close
from kline_utils import get_kline_data


# Load session epochs directly
try:
    with open("sessions.json", "r") as file:
        session_data = json.load(file)
except Exception as e:
    print(f"Error loading session data: {e}")
    session_data = {}

SYDNEY_START_EPOCH = session_data["sydney"]["start_epoch"]
SYDNEY_END_EPOCH = session_data["sydney"]["end_epoch"]

try:
    with open("sessions_yesterday.json", "r") as file:
        session_yesterday_data = json.load(file)
except Exception as e:
    print(f"Error loading session data: {e}")
    session_data = {}

NEWYORK_YESTERDAY_START_EPOCH = session_yesterday_data["ny"]["start_epoch"]
NEWYORK_YESTERDAY_END_EPOCH = session_yesterday_data["ny"]["end_epoch"]

def get_breakout_markets(symbol, position, mode="any"):
    # Get previous session klines (New York session in most cases)
    previous_session_klines = get_kline_data(symbol=symbol, interval=5, start=NEWYORK_YESTERDAY_START_EPOCH, end=NEWYORK_YESTERDAY_END_EPOCH)
    
    # Compute the mean close of the previous session
    mean_close = calculate_mean_close(previous_session_klines)
    
    # Get current session klines (Sydney session in most cases)
    current_session_klines = get_kline_data(symbol=symbol, interval=5, start=SYDNEY_START_EPOCH, end=SYDNEY_END_EPOCH)
    
    # Check if at least one candle in the current session crosses above (for long) or below (for short) the mean close
    
    if mode =="any":
        if position == "long":
            return any(float(candle[4]) > mean_close for candle in current_session_klines)
        elif position == "short":
            return any(float(candle[4]) < mean_close for candle in current_session_klines)
    
        # Check if all candles in the current session cross above (for long) or below (for short) the mean close
    elif mode == "all":

        if position == "long":
            return all(float(candle[4]) > mean_close for candle in current_session_klines)
        elif position == "short":
            return all(float(candle[4]) < mean_close for candle in current_session_klines)
    
    return False

def process_breakout_markets(csv_from, csv_to, position,filter_mode):
    qualified_markets = []
    
    with open(csv_from, mode='r', newline='') as infile:
        reader = csv.reader(infile)
        header = next(reader)  # Read header

        for row in reader:
            market, session, trendline = row[0], row[1], float(row[2])  # Extract values
            
            if get_breakout_markets(market, position,filter_mode):
                qualified_markets.append([market, session, trendline])

    # Sorting logic
    if position == "long":
        qualified_markets.sort(key=lambda x: x[2], reverse=True)  # Highest to lowest
    elif position == "short":
        qualified_markets.sort(key=lambda x: x[2])  # Most negative to least negative

    # Write to file
    with open(csv_to, mode='w', newline='') as outfile:
        writer = csv.writer(outfile)
        writer.writerow(["Market", "Session", "Trendline Slope"])  # Header
        writer.writerows(qualified_markets)

if __name__ == "__main__":
    process_breakout_markets('sell_trades/short_trades.csv','sell_trades/breakout_short_trades.csv',position="short",filter_mode='all')
    process_breakout_markets('buy_trades/long_trades.csv','buy_trades/breakout_long_trades.csv',position="long",filter_mode='all')
