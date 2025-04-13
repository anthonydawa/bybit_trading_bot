import csv
import json
from pybit.unified_trading import HTTP
from atr_indicator import calculate_atr
from get_high_lows import get_extreme_value
from get_position_size import get_position_info
from handle_markets_mark_close import update_mark_close
from kline_utils import get_kline_data
session = HTTP()

def get_session_data(session_file, session_name):
    """
    Fetches start and end epoch times from the session JSON file.
    """
    with open(session_file, 'r') as file:
        sessions = json.load(file)
    session = sessions.get(session_name)
    if session:
        return session['start_epoch'], session['end_epoch']
    else:
        raise ValueError(f"Session '{session_name}' not found in {session_file}")


# Initialize session

def get_kline_data(symbol, interval, category="linear", start=None, end=None):
    """
    Fetches kline (candlestick) data for a given symbol and interval, reversing the order to most recent first.
    """
    try:
        params = {
            "category": category,
            "symbol": symbol,
            "interval": interval,
            "limit": 300
        }
        if start:
            params["start"] = start
        if end:
            params["end"] = end
        
        response = session.get_kline(**params)
        return list(reversed(response['result']['list'][1:]))
    except Exception as e:
        return {"error": str(e)}

def calculate_atr(klines, period=14):
    """
    Computes the Average True Range (ATR) for given kline data.
    """
    high_prices = [float(kline[2]) for kline in klines]
    low_prices = [float(kline[3]) for kline in klines]
    close_prices = [float(kline[4]) for kline in klines]

    true_ranges = []
    for i in range(1, len(klines)):
        high_low = high_prices[i] - low_prices[i]
        high_prev_close = abs(high_prices[i] - close_prices[i - 1])
        low_prev_close = abs(low_prices[i] - close_prices[i - 1])
        tr = max(high_low, high_prev_close, low_prev_close)
        true_ranges.append(tr)

    if len(true_ranges) < period:
        raise ValueError("Not enough data to calculate ATR for the given period.")
    
    atr = sum(true_ranges[-period:]) / period
    return atr

def update_market_stop_loss(markets_csv, sessions_json, session_name):
    with open(sessions_json) as f:
        sessions = json.load(f)

    session = sessions.get(session_name)
    if session is None:
        raise ValueError(f"Session {session_name} not found in {sessions_json}")
    
    start_epoch = session['start_epoch']
    end_epoch = session['end_epoch']

    # Read the CSV file into memory
    with open(markets_csv, mode='r', newline='') as f:
        reader = csv.DictReader(f)
        rows = list(reader)  # Read all rows into memory

    # Update the stop_loss column for each market
    for row in rows:
        symbol = row['symbol']
        position = row['position']
        status = row['status']
        stop_loss = row['stop_loss']

        print(f"Processing Market: {symbol}, Position: {position}")

        if not isinstance(position, str):
            print(f"Skipping {symbol} because position is not a string: {position}")
            continue

        try:
            # Get the extreme value for this market and position
            extreme_value = get_extreme_value(symbol, start_epoch, end_epoch, position)

            # Fetch kline data for ATR calculation
            klines = get_kline_data(symbol, interval=5, start=start_epoch, end=end_epoch)

            if isinstance(klines, list):
                # Calculate ATR using the kline data
                atr = calculate_atr(klines)

                # Ensure extreme_value and ATR are numeric
                if isinstance(extreme_value, (int, float)) and isinstance(atr, (int, float)):
                    if position == "long":
                        stop_loss = extreme_value - (1* atr)  # Stop loss for long position
                    elif position == "short":
                        stop_loss = extreme_value +  (1 * atr)  # Stop loss for short position
                    else:
                        raise ValueError(f"Invalid position_type: {position}")

                    print(f"Updating stop loss for {symbol} to {stop_loss}")
                    row['stop_loss'] = str(stop_loss)  # Update stop_loss in the row
                else:
                    print(f"Invalid values for {symbol}: extreme_value = {extreme_value}, ATR = {atr}")
            else:
                print(f"Error fetching kline data for {symbol}: {klines}")
        except ValueError as e:
            print(f"Error processing market '{symbol}': {e}")
            continue

    # Write the updated rows back to the CSV
    with open(markets_csv, mode='w', newline='') as f:
        # Updated fieldnames to reflect all columns
        fieldnames = ['symbol', 'qty', 'position', 'status', 'stop_loss', 'mark_close','reversed']

        writer = csv.DictWriter(f, fieldnames=fieldnames)

        writer.writeheader()  # Write the header
        writer.writerows(rows)  # Write the updated rows back to the CSV

    print("CSV updated successfully.")

def update_markets_file(file_name):
    # Read the current CSV file
    with open(file_name, mode='r', newline='', encoding='utf-8') as file:
        csv_reader = csv.DictReader(file)
        rows = list(csv_reader)

    # List to store rows that will be kept
    updated_rows = []

    # Loop through each row and update based on the API data
    for row in rows:
        symbol = row['symbol']
        
        # Get the updated position info from the API
        position_info = get_position_info(symbol)
        
        # Check if the position exists and has valid qty and side
        if position_info and position_info['qty'] != '0' and position_info['side'] != '':
            # Update the qty and side in the row
            row['qty'] = position_info['qty']
            row['position'] = 'long' if position_info['side'] == 'Buy' else 'short'
            updated_rows.append(row)
        else:
            # If no position info or position doesn't exist (qty is 0 or side is empty), skip this row
            print(f"Deleting {symbol} as no valid position exists or position is empty.")

    # Write the updated data back to the CSV file
    with open(file_name, mode='w', newline='', encoding='utf-8') as file:
        fieldnames = ['symbol', 'qty', 'position', 'status', 'stop_loss', 'mark_close','reversed']  # Removed 'side'
        csv_writer = csv.DictWriter(file, fieldnames=fieldnames)

        # Write the header and updated rows (without the deleted rows)
        csv_writer.writeheader()
        csv_writer.writerows(updated_rows)

    print(f"Updated {file_name} successfully!")


if __name__ == "__main__":
    # Example usage
    update_markets_file('markets.csv')
    print('market position updated')
    update_market_stop_loss('markets.csv', 'sessions.json', 'sydney')
    print('stop loss updated')
    update_mark_close()
    print('market position updated')

