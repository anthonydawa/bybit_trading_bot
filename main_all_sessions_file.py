import time
import csv
from pybit.unified_trading import HTTP
import numpy as np
from datetime import datetime, timedelta
import pytz
from kline_utils import get_kline_data  # Import reusable kline function
from rsi_utils import compute_rsi       # Import reusable RSI function
from order_utils import place_order     # Import reusable place order function

# CSV file to store market data
MARKET_FILE = "markets.csv"

# Bot configuration
RSI_PERIOD = 14
INTERVAL = 5
LOOP_INTERVAL = 4  # Seconds
pht_timezone = pytz.timezone("Asia/Manila")

# Session Time Ranges (in PHT)
TOKYO_START = 7
TOKYO_END = 16
LONDON_START = 15
LONDON_END = 24
NY_START = 21
NY_END = 6

def load_markets_from_file():
    """Load market data from the CSV file."""
    markets = []
    try:
        with open(MARKET_FILE, mode="r") as file:
            reader = csv.DictReader(file)
            for row in reader:
                markets.append({
                    "symbol": row["symbol"],
                    "qty": row["qty"],
                    "position": row["position"],
                    "status": row["status"],
                    "stop_loss": float(row["stop_loss"]),
                    "mark_close": row["mark_close"] == "True"
                })
    except FileNotFoundError:
        print(f"{MARKET_FILE} not found. Starting with an empty market list.")
    return markets

def save_markets_to_file(markets):
    """Save market data to the CSV file."""
    with open(MARKET_FILE, mode="w", newline="") as file:
        fieldnames = ["symbol", "qty", "position", "status", "stop_loss", "mark_close"]
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for market in markets:
            writer.writerow(market)

def determine_session(now_pht):
    """Determine the current trading session based on PHT time."""
    if TOKYO_START <= now_pht.hour < TOKYO_END:
        return "Tokyo"
    elif LONDON_START <= now_pht.hour < LONDON_END:
        return "London"
    elif now_pht.hour >= NY_START or now_pht.hour < NY_END:
        return "New York"
    else:
        return "Off-hours"

def close_marked_trades(markets):
    """Close all trades marked for closure."""
    for market in markets:
        if market["mark_close"] and market["status"] == "open":
            side = "Buy" if market["position"] == "short" else "Sell"
            order_response = place_order(symbol=market["symbol"], qty=market["qty"], side=side)
            print(f"Closing marked trade for {market['symbol']}: {order_response}")
            market["status"] = "closed"
            market["mark_close"] = False
    save_markets_to_file(markets)

def close_all_trades(markets):
    """Force-close all open trades at the end of a session."""
    for market in markets:
        if market["status"] == "open":
            side = "Buy" if market["position"] == "short" else "Sell"
            order_response = place_order(symbol=market["symbol"], qty=market["qty"], side=side)
            print(f"Force-closing trade for {market['symbol']}: {order_response}")
            market["status"] = "closed"
    save_markets_to_file(markets)

def trading_bot():
    """Main trading bot loop with session-based strategies."""
    markets = load_markets_from_file()
    while True:
        try:
            now_pht = datetime.now(pht_timezone)
            session = determine_session(now_pht)
            print(f"Current Session: {session} | Time: {now_pht.strftime('%Y-%m-%d %H:%M:%S')} PHT")

            for market in markets:
                if market["status"] == "closed":
                    continue

                symbol = market["symbol"]
                qty = market["qty"]
                position = market["position"]
                stop_loss = market["stop_loss"]

                # Fetch kline data
                kline_data = get_kline_data(symbol=symbol, interval=INTERVAL)
                if "error" in kline_data:
                    print(f"Error fetching kline data for {symbol}: {kline_data['error']}")
                    continue

                current_price = float(kline_data[-1][4])
                rsi_value = compute_rsi(data=kline_data, period=RSI_PERIOD)

                if isinstance(rsi_value, dict) and "error" in rsi_value:
                    print(f"Error calculating RSI for {symbol}: {rsi_value['error']}")
                    continue

                print(f"Market: {symbol}, Price: {current_price}, RSI: {rsi_value}, Position: {position}")

                # Stop-loss check
                if (position == "short" and current_price > stop_loss) or \
                   (position == "long" and current_price < stop_loss):
                    side = "Buy" if position == "short" else "Sell"
                    print(f"Price hit stop-loss for {symbol}. Closing position.")
                    order_response = place_order(symbol=symbol, qty=qty, side=side)
                    print(f"Stop-Loss Order Response for {symbol}: {order_response}")
                    market["status"] = "closed"
                    save_markets_to_file(markets)
                    continue

                # Session-specific behavior
                if session == "Tokyo" and position == "short" and rsi_value < 30:
                    print(f"RSI hit in Tokyo for {symbol}. Marking for closure.")
                    market["mark_close"] = True


                elif session == "London":
                    if position == "short" and rsi_value < 30 or position == "long" and rsi_value > 70:
                        side = "Buy" if position == "short" else "Sell"
                        print(f"RSI hit in London for {symbol}. Closing trade immediately.")
                        order_response = place_order(symbol=symbol, qty=qty, side=side)
                        print(f"Order Response for {symbol}: {order_response}")
                        market["status"] = "closed"
                        save_markets_to_file(markets)  # Save after closing the trade


                elif session == "New York":
                    if position == "short" and rsi_value < 30 or position == "long" and rsi_value > 70:
                        side = "Buy" if position == "short" else "Sell"
                        print(f"RSI hit in New York for {symbol}. Closing trade immediately.")
                        order_response = place_order(symbol=symbol, qty=qty, side=side)
                        print(f"Order Response for {symbol}: {order_response}")
                        market["status"] = "closed"
                        save_markets_to_file(markets)  # Save after closing the trade



            # End-of-session logic
            if session == "Tokyo" and now_pht.hour == TOKYO_END - 1 and now_pht.minute >= 59:
                print("Tokyo session ending soon. Closing marked trades.")
                close_marked_trades(markets)

            if session == "New York" and now_pht.hour == NY_END - 1 and now_pht.minute >= 49:
                print("New York session ending soon. Closing all remaining trades.")
                close_all_trades(markets)
            

        except Exception as e:
            print(f"An error occurred: {str(e)}")

        time.sleep(LOOP_INTERVAL)

if __name__ == "__main__":
    print("Starting Trading Bot...")
    trading_bot()
