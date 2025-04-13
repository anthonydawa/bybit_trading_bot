import time
from pybit.unified_trading import HTTP
import numpy as np
from kline_utils import get_kline_data  # Import your reusable kline function
from rsi_utils import compute_rsi       # Import your reusable RSI function
from order_utils import place_order     # Import your reusable place order function
from datetime import datetime
import pytz
from datetime import timedelta

# List of markets with their respective quantities, positions (long/short), status (open/closed), and stop loss
markets = [
    {"symbol": "VANAUSDT", "qty": "5.86", "position": "short", "status": "open", "stop_loss": 17.75},
    {"symbol": "ZEREBROUSDT", "qty": "86", "position": "short", "status": "open", "stop_loss": 0.6140},
    {"symbol": "STGUSDT", "qty": "107.4", "position": "short", "status": "open", "stop_loss": 0.5},
    {"symbol": "UNIUSDT", "qty": "6.6", "position": "short", "status": "open", "stop_loss": 15.3},
    {"symbol": "DRIFTUSDT", "qty": "35", "position": "short", "status": "open", "stop_loss": 1.4823},
    {"symbol": "KOMAUSDT", "qty": "402", "position": "short", "status": "open", "stop_loss": 0.13139},
]

# Bot configuration
RSI_PERIOD = 14  # Lookback period for RSI calculation
INTERVAL = 5     # Kline interval in minutes
LOOP_INTERVAL = 4  # Time to wait between iterations in seconds
CLOSE_ALL_AT_4PM = True  # Enable or disable the feature to close all trades at 4 PM PHT
days_from_now = 0  # 0 for today, 1 for tomorrow, 2 for the day after tomorrow, etc.

# Define the PHT timezone
pht_timezone = pytz.timezone("Asia/Manila")

def trading_bot():
    """
    Main trading bot loop. It runs indefinitely, checking RSI values for the specified markets and
    executing trades based on RSI thresholds, stop-loss levels, and the time-based condition.
    """
    while True:
        try:
            # Get the current time in PHT
            now_pht = datetime.now(pht_timezone)

            # Calculate the close time based on the days_from_now
            close_time_pht = now_pht.replace(hour=15, minute=50, second=0, microsecond=0) + timedelta(days=days_from_now)

            # Check if the time exceeds the close time and CLOSE_ALL_AT_4PM is True
            if CLOSE_ALL_AT_4PM and now_pht >= close_time_pht:
                print(f"Time is past {close_time_pht.strftime('%Y-%m-%d %H:%M:%S')} PHT. Closing all open trades.")
                for market in markets:
                    if market["status"] == "open":
                        symbol = market["symbol"]
                        qty = market["qty"]
                        position = market["position"]

                        # Determine the side to close the position
                        side = "Buy" if position == "short" else "Sell"
                        print(f"Closing {position} position for {symbol} with a {side} order.")
                        order_response = place_order(
                            symbol=symbol,
                            qty=qty,
                            side=side
                        )
                        print(f"Order Response for {symbol}: {order_response}")
                        market["status"] = "closed"  # Mark the order as closed
                print("All trades closed. Exiting bot.")
                break  # Exit the bot after closing all trades

            # Check if all positions are closed
            all_closed = all(market["status"] == "closed" for market in markets)
            if all_closed:
                print("All positions are closed. Waiting for the next loop...")
                time.sleep(LOOP_INTERVAL)
                continue

            for market in markets:
                symbol = market["symbol"]
                qty = market["qty"]
                position = market["position"]
                status = market["status"]
                stop_loss = market["stop_loss"]

                # Skip market if status is 'closed'
                if status == "closed":
                    continue

                # Fetch kline data
                kline_data = get_kline_data(symbol=symbol, interval=INTERVAL)
                if "error" in kline_data:
                    print(f"Error fetching kline data for {symbol}: {kline_data['error']}")
                    continue

                # Extract the latest close price (assuming it's at index 4)
                last_candle = kline_data[-1]
                current_price = float(last_candle[4])  # Close price is usually at index 4
                print(f"Market: {symbol}, Current Price: {current_price}, Stop Loss: {stop_loss}")

                # Check stop-loss conditions
                if position == "short" and current_price > stop_loss:
                    print(f"Price for {symbol} exceeded stop-loss ({stop_loss}) in short position. Closing position.")
                    order_response = place_order(
                        symbol=symbol,
                        qty=qty,
                        side="Buy"
                    )
                    print(f"Stop-Loss Order Response for {symbol}: {order_response}")
                    market["status"] = "closed"  # Mark the order as closed
                    continue

                if position == "long" and current_price < stop_loss:
                    print(f"Price for {symbol} fell below stop-loss ({stop_loss}) in long position. Closing position.")
                    order_response = place_order(
                        symbol=symbol,
                        qty=qty,
                        side="Sell"
                    )
                    print(f"Stop-Loss Order Response for {symbol}: {order_response}")
                    market["status"] = "closed"  # Mark the order as closed
                    continue

                # Compute RSI
                rsi_value = compute_rsi(data=kline_data, period=RSI_PERIOD)
                if isinstance(rsi_value, dict) and "error" in rsi_value:
                    print(f"Error calculating RSI for {symbol}: {rsi_value['error']}")
                    continue

                print(f"Market: {symbol}, RSI: {rsi_value}, Position: {position}")

                # Execute trades based on RSI value and position
                if position == "short":
                    # Look for RSI below 30 when in a short position to buy (close short position)
                    if rsi_value < 30:
                        print(f"RSI below 30 for {symbol} (short position). Closing short position and placing a Buy order.")
                        order_response = place_order(
                            symbol=symbol,
                            qty=qty,
                            side="Buy"
                        )
                        print(f"Buy Order Response for {symbol}: {order_response}")
                        market["status"] = "closed"  # Mark the order as closed

                elif position == "long":
                    # Look for RSI above 70 when in a long position to sell (close long position)
                    if rsi_value > 70:
                        print(f"RSI above 70 for {symbol} (long position). Closing long position and placing a Sell order.")
                        order_response = place_order(
                            symbol=symbol,
                            qty=qty,
                            side="Sell"
                        )
                        print(f"Sell Order Response for {symbol}: {order_response}")
                        market["status"] = "closed"  # Mark the order as closed

        except Exception as e:
            print(f"An error occurred: {str(e)}")

        # Wait before the next loop iteration
        time.sleep(LOOP_INTERVAL)

if __name__ == "__main__":
    print("Starting Trading Bot...")
    trading_bot()
