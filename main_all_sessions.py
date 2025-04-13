import time
from pybit.unified_trading import HTTP
import numpy as np
from datetime import datetime, timedelta
import pytz
from kline_utils import get_kline_data  # Import reusable kline function
from rsi_utils import compute_rsi       # Import reusable RSI function
from order_utils import place_order     # Import reusable place order function

# List of markets with their respective quantities, positions, status, and stop loss
markets = [
    {"symbol": "BTCUSDT", "qty": "0.002", "position": "short", "status": "open", "stop_loss": 98798, "mark_close": False},
    {"symbol": "XRPUSDT", "qty": "83", "position": "short", "status": "open", "stop_loss": 2.4427, "mark_close": True},
    {"symbol": "ENAUSDT", "qty": "82", "position": "short", "status": "open", "stop_loss": 1.2564, "mark_close": False},
    {"symbol": "SUIUSDT", "qty": "10", "position": "short", "status": "open", "stop_loss": 5.3681, "mark_close": False},
    {"symbol": "CRVUSDT", "qty": "192", "position": "short", "status": "open", "stop_loss": 1.068, "mark_close": True},
    {"symbol": "ONDOUSDT", "qty": "191", "position": "short", "status": "open", "stop_loss": 1.61, "mark_close": True},
    {"symbol": "FARTCOINUSDT", "qty": "71", "position": "short", "status": "open", "stop_loss": 1.46, "mark_close": True},
    {"symbol": "SANDUSDT", "qty": "154", "position": "short", "status": "open", "stop_loss": 0.6569, "mark_close": False},
    {"symbol": "DOTUSDT", "qty": "13", "position": "short", "status": "open", "stop_loss": 7.735, "mark_close": True},
    {"symbol": "APTUSDT", "qty": "10.05", "position": "short", "status": "open", "stop_loss": 10.079, "mark_close": False},
]

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

def determine_session(now_pht):
    """
    Determines the current trading session based on PHT time.
    """
    if TOKYO_START <= now_pht.hour < TOKYO_END:
        return "Tokyo"
    elif LONDON_START <= now_pht.hour < LONDON_END:
        return "London"
    elif now_pht.hour >= NY_START or now_pht.hour < NY_END:
        return "New York"
    else:
        return "Off-hours"

def close_marked_trades():
    """Close all trades marked for closure."""
    for market in markets:
        if market["mark_close"] and market["status"] == "open":
            side = "Buy" if market["position"] == "short" else "Sell"
            order_response = place_order(symbol=market["symbol"], qty=market["qty"], side=side)
            print(f"Closing marked trade for {market['symbol']}: {order_response}")
            market["status"] = "closed"
            market["mark_close"] = False

def close_all_trades():
    """Force-close all open trades at the end of a session."""
    for market in markets:
        if market["status"] == "open":
            side = "Buy" if market["position"] == "short" else "Sell"
            order_response = place_order(symbol=market["symbol"], qty=market["qty"], side=side)
            print(f"Force-closing trade for {market['symbol']}: {order_response}")
            market["status"] = "closed"

def trading_bot():
    """
    Main trading bot loop with session-based strategies.
    """
    while True:
        try:
            # Get current time in PHT
            now_pht = datetime.now(pht_timezone)
            session = determine_session(now_pht)
            print(f"Current Session: {session} | Time: {now_pht.strftime('%Y-%m-%d %H:%M:%S')} PHT")

            for market in markets:

                if market["mark_close"]:
                    print(f"Market marked for closure: {market['symbol']}")

                symbol = market["symbol"]
                qty = market["qty"]
                position = market["position"]
                status = market["status"]
                stop_loss = market["stop_loss"]

                if status == "closed":
                    continue

                # Fetch kline data
                kline_data = get_kline_data(symbol=symbol, interval=INTERVAL)
                if "error" in kline_data:
                    print(f"Error fetching kline data for {symbol}: {kline_data['error']}")
                    continue

                # Extract close price and compute RSI
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
                    continue

                # Session-specific behavior
                if session == "Tokyo":
                    if position == "short" and rsi_value < 30 or position == "long" and rsi_value > 70:
                        print(f"RSI hit in Tokyo for {symbol}. Marking for closure.")
                        market["mark_close"] = True

                elif session == "London":
                    if position == "short" and rsi_value < 30 or position == "long" and rsi_value > 70:
                        side = "Buy" if position == "short" else "Sell"
                        print(f"RSI hit in London for {symbol}. Closing trade immediately.")
                        order_response = place_order(symbol=symbol, qty=qty, side=side)
                        print(f"Order Response for {symbol}: {order_response}")
                        market["status"] = "closed"
                        

                elif session == "New York":
                    if position == "short" and rsi_value < 30 or position == "long" and rsi_value > 70:
                        side = "Buy" if position == "short" else "Sell"
                        print(f"RSI hit in New York for {symbol}. Closing trade immediately.")
                        order_response = place_order(symbol=symbol, qty=qty, side=side)
                        print(f"Order Response for {symbol}: {order_response}")
                        market["status"] = "closed"


            # End of session logic with 30 minutes buffer
            if session == "Tokyo" and now_pht.hour == TOKYO_END - 1 and now_pht.minute >= 50:
                print("Tokyo session ending soon. Closing marked trades.")
                close_marked_trades()

            if session == "New York" and now_pht.hour == NY_END - 1 and now_pht.minute >= 50:
                print("New York session ending soon. Closing all remaining trades.")
                close_all_trades()



        except Exception as e:
            print(f"An error occurred: {str(e)}")

        time.sleep(LOOP_INTERVAL)

if __name__ == "__main__":
    print("Starting Trading Bot...")
    trading_bot()
