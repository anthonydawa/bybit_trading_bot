import time
from pybit.unified_trading import HTTP
import numpy as np
from kline_utils import get_kline_data  # Import your reusable kline function
from rsi_utils import compute_rsi       # Import your reusable RSI function
from order_utils import place_order     # Import your reusable place order function
from datetime import datetime, timedelta
import pytz

# List of markets with their respective quantities, positions, status, and stop loss
markets = [
    {"symbol": "BTCUSDT", "qty": "0.002", "position": "short", "status": "open", "stop_loss": 98798},
]

# Bot configuration
RSI_PERIOD = 14
INTERVAL = 5
LOOP_INTERVAL = 4  # Seconds
pht_timezone = pytz.timezone("Asia/Manila")

def determine_session(now_pht):
    """
    Determines the current trading session based on PHT time.
    """
    if 9 <= now_pht.hour < 15:  # Tokyo session
        return "Tokyo"
    elif 15 <= now_pht.hour < 21:  # London session
        return "London"
    elif 21 <= now_pht.hour or now_pht.hour < 6:  # NY session spans midnight (0:00) to 6 AM PHT
        return "New York"
    else:
        return "Off-hours"

def trading_bot():
    """
    Main trading bot loop with session handling.
    """
    while True:
        try:
            # Get current time in PHT
            now_pht = datetime.now(pht_timezone)
            session = determine_session(now_pht)
            print(f"Current Session: {session} | Time: {now_pht.strftime('%Y-%m-%d %H:%M:%S')} PHT")

            for market in markets:
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

                # Close based on RSI thresholds
                if position == "short" and rsi_value < 30:
                    print(f"RSI below 30 for {symbol}. Closing short position.")
                    order_response = place_order(symbol=symbol, qty=qty, side="Buy")
                    print(f"Order Response for {symbol}: {order_response}")
                    market["status"] = "closed"
                elif position == "long" and rsi_value > 70:
                    print(f"RSI above 70 for {symbol}. Closing long position.")
                    order_response = place_order(symbol=symbol, qty=qty, side="Sell")
                    print(f"Order Response for {symbol}: {order_response}")
                    market["status"] = "closed"

                # Check stop-loss
                if (position == "short" and current_price > stop_loss) or \
                   (position == "long" and current_price < stop_loss):
                    side = "Buy" if position == "short" else "Sell"
                    print(f"Price hit stop-loss for {symbol}. Closing position.")
                    order_response = place_order(symbol=symbol, qty=qty, side=side)
                    print(f"Stop-Loss Order Response for {symbol}: {order_response}")
                    market["status"] = "closed"

        except Exception as e:
            print(f"An error occurred: {str(e)}")

        time.sleep(LOOP_INTERVAL)

if __name__ == "__main__":
    print("Starting Trading Bot...")
    trading_bot()
2