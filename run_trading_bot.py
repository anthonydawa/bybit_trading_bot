import time
import csv
from pybit.unified_trading import HTTP
import numpy as np
from datetime import datetime
import pytz
from calculate_mean import calculate_mean_close
from get_market_trend import get_market_trendline_slope
from kline_utils import get_kline_data  # Import reusable kline function
from rsi_utils import compute_rsi       # Import reusable RSI function
from order_utils import place_order     # Import reusable place order function
import json

from vwap_indicator import get_vwap
# CSV file to store market data
MARKET_FILE = "markets.csv"

# Bot configuration
RSI_PERIOD = 12
INTERVAL = 5
LOOP_INTERVAL = 12  # Seconds
pht_timezone = pytz.timezone("Asia/Manila")

# Toggle True or False for session specific behavior
ALL_SESSION_STRAT = False

# Session Time Ranges (in PHT)
SYDNEY_START = 5
SYDNEY_END = 14
TOKYO_START = 8
TOKYO_END = 17
LONDON_START = 15
LONDON_END = 24
NY_START = 21
NY_END = 6

# Configurable number of candles for trailing stop loss calculation
TRAILING_STOP_CANDLE_COUNT = 3  # You can change this number as needed

# Load session epochs directly
try:
    with open("sessions.json", "r") as file:
        session_data = json.load(file)
except Exception as e:
    print(f"Error loading session data: {e}")
    session_data = {}

# Check if Tokyo session data is available
if "tokyo" not in session_data:
    print("Tokyo session data not found in sessions.json.")
    

TOKYO_START_EPOCH = session_data["tokyo"]["start_epoch"]
TOKYO_END_EPOCH = session_data["tokyo"]["end_epoch"]
SYDNEY_START_EPOCH = session_data["sydney"]["start_epoch"]
SYDNEY_END_EPOCH = session_data["sydney"]["end_epoch"]
LONDON_START_EPOCH = session_data["london"]["start_epoch"]
LONDON_END_EPOCH = session_data["london"]["end_epoch"]

def is_five_minute_mark():
    now = datetime.now()
    return now.minute % 1 == 0

def check_open_positions(markets):
    """Check if there are any open positions."""
    for market in markets:
        if market["status"] == "open":
            return True
    return False

def get_highest_high(candles, count):
    """Get the highest high from the last 'count' closed candles."""
    return max(float(candle[2]) for candle in candles[-count:])

def get_lowest_low(candles, count):
    """Get the lowest low from the last 'count' closed candles."""
    return min(float(candle[3]) for candle in candles[-count:])

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
    """Save the updated market data to the CSV file."""
    fieldnames = ["symbol", "qty", "position", "status", "stop_loss", "mark_close"]
    try:
        with open(MARKET_FILE, mode="w", newline="") as file:
            writer = csv.DictWriter(file, fieldnames=fieldnames)
            writer.writeheader()
            for market in markets:
                writer.writerow({
                    "symbol": market["symbol"],
                    "qty": market["qty"],
                    "position": market["position"],
                    "status": market["status"],
                    "stop_loss": market["stop_loss"],
                    "mark_close": market["mark_close"]
                })
        print("Markets successfully saved to file.")
    except Exception as e:
        print(f"Error saving markets to file: {e}")


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
    # Iterate over the given list of markets (subset or full list)
    for market in markets:
        if market["mark_close"] and market["status"] == "open":
            side = "Buy" if market["position"] == "short" else "Sell"
            try:
                order_response = place_order(symbol=market["symbol"], qty=market["qty"], side=side)
                print(f"Closing marked trade for {market['symbol']}: {order_response}")
                market["status"] = "closed"
                market["mark_close"] = False  # Unmark it for closure after processing
            except Exception as e:
                print(f"Error closing marked trade for {market['symbol']}: {e}")
    
    # Save updates for all markets
    save_markets_to_file(markets)

def close_all_trades(markets):
    """Force-close all open trades at the end of a session."""
    for market in markets:
        if market["status"] == "open":
            side = "Buy" if market["position"] == "short" else "Sell"
            try:
                order_response = place_order(symbol=market["symbol"], qty=market["qty"], side=side)
                print(f"Force-closing trade for {market['symbol']}: {order_response}")
                market["status"] = "closed"
            except Exception as e:
                print(f"Error closing trade for {market['symbol']}: {e}")
    save_markets_to_file(markets)

def trading_bot(num_markets=None):

    """Main trading bot loop with session-based strategies."""
    markets = load_markets_from_file()
    while True:
        try:
            markets = load_markets_from_file()
            # Stop the bot if there are no open positions
            if not check_open_positions(markets):
                print("No open positions left. Stopping the trading bot.")
                break  

            # Check if num_markets is provided, then check active positions condition
            if num_markets is not None:
                active_positions = sum(1 for market in markets if market["status"] == "open")
                if active_positions < 0.3 * num_markets:
                    print(f"Active positions ({active_positions}) are less than 30% of total markets ({num_markets}). Closing all trades.")
                    close_all_trades(markets)
                    break
            
            now_pht = datetime.now(pht_timezone)
            session = determine_session(now_pht)
            print(f"Current Session: {session} | Time: {now_pht.strftime('%Y-%m-%d %H:%M:%S')} PHT") 


            print("Saving the following markets data to file:")
            print(markets)
           

            for market in markets:
                
                if market["status"] == "closed":
                    continue

                symbol = market["symbol"]
                qty = market["qty"]
                position = market["position"]
                stop_loss = market["stop_loss"]

                # Fetch kline dataq
                kline_data = get_kline_data(symbol=symbol, interval=INTERVAL)
                if "error" in kline_data:
                    print(f"Error fetching kline data for {symbol}: {kline_data['error']}")
                    continue

                if is_five_minute_mark():
                    # Compute trendline slope
                    kline_session_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=TOKYO_START_EPOCH,end=TOKYO_END_EPOCH)
                    if "error" in kline_session_data:
                        print(f"Error fetching kline data for {symbol}: {kline_session_data['error']}")
                        continue

                    trendline_slope = get_market_trendline_slope(kline_session_data)
                    print(f"Market: {symbol}, Trendline Slope: {trendline_slope}")

                    mean_close = calculate_mean_close(kline_session_data)
                    print(f"Market: {symbol}, Mean Close: {mean_close}")

                current_price = float(kline_data[-1][4])

                rsi_value = compute_rsi(data=kline_data, period=RSI_PERIOD)

                if isinstance(rsi_value, dict) and "error" in rsi_value:
                    print(f"Error calculating RSI for {symbol}: {rsi_value['error']}")
                    continue

                print(f"Market: {symbol}, Price: {current_price}, RSI: {rsi_value}, Position: {position}, Stop Loss: {stop_loss} ")

                # STOPLOSS CHECK EXECUTING STOPLOSS 
                if (position == "short" and current_price > stop_loss) or \
                   (position == "long" and current_price < stop_loss):
                    side = "Buy" if position == "short" else "Sell"
                    print(f"Price hit stop-loss for {symbol}. Closing position.")
                    order_response = place_order(symbol=symbol, qty=qty, side=side)
                    print(f"Stop-Loss Order Response for {symbol}: {order_response}")
                    market["status"] = "closed"
                    save_markets_to_file(markets)
                    continue

                # STOP LOSS BEHAVIOR DEPENDING ON STRATEGY FOR THE DAY

                if ALL_SESSION_STRAT:
                    # Run the same logic as London and New York sessions for all sessions
                    if position == "short" and rsi_value < 30:
                        new_stop_loss = get_highest_high(kline_data, TRAILING_STOP_CANDLE_COUNT)
                        if new_stop_loss != stop_loss:
                            print(f"Updating trailing stop-loss for {symbol} to {new_stop_loss} (All session).")
                            market["stop_loss"] = new_stop_loss
                            save_markets_to_file(markets)

                    elif position == "long" and rsi_value > 70:
                        new_stop_loss = get_lowest_low(kline_data, TRAILING_STOP_CANDLE_COUNT)
                        if new_stop_loss != stop_loss:
                            print(f"Updating trailing stop-loss for {symbol} to {new_stop_loss} (All session).")
                            market["stop_loss"] = new_stop_loss
                            save_markets_to_file(markets)

                elif not ALL_SESSION_STRAT:
                    # Run specific session-based logic if ALL_SESSION_STRAT is False
                    if session == "Tokyo":
                        if position == "short" and rsi_value < 30:
                            print(f"RSI hit in Tokyo for {symbol}. Marking for closure.")
                            market["mark_close"] = True
                            save_markets_to_file(markets)

                        elif position == "long" and rsi_value > 70:
                            print(f"RSI hit in Tokyo for {symbol}. Marking for closure.")
                            market["mark_close"] = True
                            save_markets_to_file(markets)

                    # if session == "London" or now_pht.hour == 15 and 0 <= now_pht.minute <= 2:
                    if (session == "London") or (session == "Tokyo" and (15 <= now_pht.hour < 17 or (now_pht.hour == 17 and now_pht.minute == 0))):
                        if position == "short" and rsi_value < 30:
                            new_stop_loss = get_highest_high(kline_data, TRAILING_STOP_CANDLE_COUNT)
                            if new_stop_loss != stop_loss:
                                print(f"Updating trailing stop-loss for {symbol} to {new_stop_loss} (London session).")
                                market["stop_loss"] = new_stop_loss
                                save_markets_to_file(markets)

                        elif position == "long" and rsi_value > 70:
                            new_stop_loss = get_lowest_low(kline_data, TRAILING_STOP_CANDLE_COUNT)
                            if new_stop_loss != stop_loss:
                                print(f"Updating trailing stop-loss for {symbol} to {new_stop_loss} (London session).")
                                market["stop_loss"] = new_stop_loss
                                save_markets_to_file(markets)

                    if session == "New York":
                        if position == "short" and rsi_value < 30:
                            new_stop_loss = get_highest_high(kline_data, TRAILING_STOP_CANDLE_COUNT)
                            if new_stop_loss != stop_loss:
                                print(f"Updating trailing stop-loss for {symbol} to {new_stop_loss} (New York session).")
                                market["stop_loss"] = new_stop_loss
                                save_markets_to_file(markets)

                        elif position == "long" and rsi_value > 70:
                            new_stop_loss = get_lowest_low(kline_data, TRAILING_STOP_CANDLE_COUNT)
                            if new_stop_loss != stop_loss:
                                print(f"Updating trailing stop-loss for {symbol} to {new_stop_loss} (New York session).")
                                market["stop_loss"] = new_stop_loss
                                save_markets_to_file(markets)


            # MEAN STOPLOSS UPDATE PER END SESSION

            if now_pht.hour == SYDNEY_END and 0 <= now_pht.minute <= 2 and not ALL_SESSION_STRAT:
                
                for market in markets:
                    if market["status"] == "open":
                        symbol = market["symbol"]
                        position = market["position"]  # "long" or "short"
                        current_stop_loss = market["stop_loss"]

                        # Fetch Tokyo session data for the current market
                        kline_session_data = get_kline_data(
                            symbol=symbol, interval=INTERVAL, start=SYDNEY_START_EPOCH, end=SYDNEY_END_EPOCH
                        )
                        if "error" in kline_session_data:
                            print(f"Error fetching kline data for {symbol}: {kline_session_data['error']}")
                            continue

                        # Calculate the mean close for the Tokyo session
                        mean_close = calculate_mean_close(kline_session_data)
                        print(f"Market: {symbol}, Mean Close: {mean_close}")
                        print(f"Market: {symbol}, Current Stop Loss: {current_stop_loss}")

                        # Update stop loss based on position and mean close
                        if position == "long":
                            # Move stop loss up only if the new stop loss is closer (higher than the current one)
                            if mean_close > current_stop_loss:
                                market["stop_loss"] = mean_close  # Update stop loss in the market object
                                print(f"Stop loss for {symbol} (long) moved to: {mean_close}")
                                save_markets_to_file(markets)

                                
                            else:
                                print(f"No change to stop loss for {symbol} (long). New stop loss ({mean_close}) is lower than current ({current_stop_loss}).")

                        elif position == "short":
                            # Move stop loss down only if the new stop loss is closer (lower than the current one)
                            if mean_close < current_stop_loss:
                                market["stop_loss"] = mean_close  # Update stop loss in the market object
                                print(f"Stop loss for {symbol} (short) moved to: {mean_close}")
                                save_markets_to_file(markets)
                            else:
                                print(f"No change to stop loss for {symbol} (short). New stop loss ({mean_close}) is higher than current ({current_stop_loss}).")
                
            elif now_pht.hour == TOKYO_END and 0 <= now_pht.minute <= 2 and not ALL_SESSION_STRAT:

                for market in markets:
                    if market["status"] == "open":
                        symbol = market["symbol"]
                        position = market["position"]  # "long" or "short"
                        current_stop_loss = market["stop_loss"]

                        # Fetch Tokyo session data for the current market
                        kline_session_data = get_kline_data(
                            symbol=symbol, interval=INTERVAL, start=TOKYO_START_EPOCH, end=TOKYO_END_EPOCH
                        )
                        if "error" in kline_session_data:
                            print(f"Error fetching kline data for {symbol}: {kline_session_data['error']}")
                            continue

                        # Calculate the mean close for the Tokyo session
                        mean_close = calculate_mean_close(kline_session_data)
                        print(f"Market: {symbol}, Mean Close: {mean_close}")
                        print(f"Market: {symbol}, Current Stop Loss: {current_stop_loss}")

                        # Update stop loss based on position and mean close
                        if position == "long":
                            # Move stop loss up only if the new stop loss is closer (higher than the current one)
                            if mean_close > current_stop_loss:
                                market["stop_loss"] = mean_close  # Update stop loss in the market object
                                print(f"Stop loss for {symbol} (long) moved to: {mean_close}")
                                save_markets_to_file(markets)

                                
                            else:
                                print(f"No change to stop loss for {symbol} (long). New stop loss ({mean_close}) is lower than current ({current_stop_loss}).")

                        elif position == "short":
                            # Move stop loss down only if the new stop loss is closer (lower than the current one)
                            if mean_close < current_stop_loss:
                                market["stop_loss"] = mean_close  # Update stop loss in the market object
                                print(f"Stop loss for {symbol} (short) moved to: {mean_close}")
                                save_markets_to_file(markets)
                            else:
                                print(f"No change to stop loss for {symbol} (short). New stop loss ({mean_close}) is higher than current ({current_stop_loss}).")

            elif now_pht.hour == LONDON_END and 0 <= now_pht.minute <= 2 and not ALL_SESSION_STRAT:
                  
                  for market in markets:
                    if market["status"] == "open":
                        symbol = market["symbol"]
                        position = market["position"]  # "long" or "short"
                        current_stop_loss = market["stop_loss"]

                        # Fetch Tokyo session data for the current market
                        kline_session_data = get_kline_data(
                            symbol=symbol, interval=INTERVAL, start=LONDON_START_EPOCH, end=LONDON_END_EPOCH
                        )
                        if "error" in kline_session_data:
                            print(f"Error fetching kline data for {symbol}: {kline_session_data['error']}")
                            continue

                        # Calculate the mean close for the Tokyo session
                        mean_close = calculate_mean_close(kline_session_data)
                        print(f"Market: {symbol}, Mean Close: {mean_close}")
                        print(f"Market: {symbol}, Current Stop Loss: {current_stop_loss}")

                        # Update stop loss based on position and mean close
                        if position == "long":
                            # Move stop loss up only if the new stop loss is closer (higher than the current one)
                            if mean_close > current_stop_loss:
                                market["stop_loss"] = mean_close  # Update stop loss in the market object
                                print(f"Stop loss for {symbol} (long) moved to: {mean_close}")
                                save_markets_to_file(markets)

                                
                            else:
                                print(f"No change to stop loss for {symbol} (long). New stop loss ({mean_close}) is lower than current ({current_stop_loss}).")

                        elif position == "short":
                            # Move stop loss down only if the new stop loss is closer (lower than the current one)
                            if mean_close < current_stop_loss:
                                market["stop_loss"] = mean_close  # Update stop loss in the market object
                                print(f"Stop loss for {symbol} (short) moved to: {mean_close}")
                                save_markets_to_file(markets)
                            else:
                                print(f"No change to stop loss for {symbol} (short). New stop loss ({mean_close}) is higher than current ({current_stop_loss}).")

            # #VWAP CHECKING PER END SESSION
            # if now_pht.hour == SYDNEY_END and 0 <= now_pht.minute <= 2 and not ALL_SESSION_STRAT:
                
            #     print("Tokyo session ending soon. Calculating VWAP and evaluating positions.")

            #     for market in markets:
            #         if market["status"] == "open" and market.get("mark_close", False):
            #             symbol = market["symbol"]
            #             position = market["position"]
            #             qty = market["qty"]

            #             # Fetch kline data using Tokyo session epochs
            #             kline_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=SYDNEY_START_EPOCH, end=SYDNEY_END_EPOCH)
            #             if "error" in kline_data:
            #                 print(f"Error fetching kline data for {symbol}: {kline_data['error']}")
            #                 continue
                        
            #             vwap_value = get_vwap(kline_data)
            #             close_price = float(kline_data[-1][4])  # Latest closing price
                        
            #             print(f"{symbol} | VWAP: {vwap_value} | Close Price: {close_price} | Position: {position}")
                        
            #             # Evaluate conditions to keep or close the position
            #             if position == "long":
            #                 if close_price > vwap_value:
            #                     print(f"{symbol}: Close price is higher than VWAP for long position. Keeping the position open.")
            #                     continue  # Keep the position open and proceed to the next market
            #                 else:
            #                     # Close the position if condition is not met
            #                     order_response = place_order(symbol=symbol, qty=qty, side="Sell")
            #                     print(f"VWAP Stop-Loss Order Response for {symbol}: {order_response}")
            #                     market["status"] = "closed"
            #                     save_markets_to_file(markets)

            #             elif position == "short":
            #                 if close_price < vwap_value:
            #                     print(f"{symbol}: Close price is lower than VWAP for short position. Keeping the position open.")
            #                     continue  # Keep the position open and proceed to the next market
            #                 else:
            #                     # Close the position if condition is not met
            #                     order_response = place_order(symbol=symbol, qty=qty, side="Buy")
            #                     print(f"VWAP Stop-Loss Order Response for {symbol}: {order_response}")
            #                     market["status"] = "closed"
            #                     save_markets_to_file(markets)                                
            
            # elif now_pht.hour == TOKYO_END and 0 <= now_pht.minute <= 2 and not ALL_SESSION_STRAT:
                
            #     print("Tokyo session ending soon. Calculating VWAP and evaluating positions.")

            #     for market in markets:
            #         if market["status"] == "open" and market.get("mark_close", False):
            #             symbol = market["symbol"]
            #             position = market["position"]
            #             qty = market["qty"]

            #             # Fetch kline data using Tokyo session epochs
            #             kline_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=TOKYO_START_EPOCH, end=TOKYO_END_EPOCH)
            #             if "error" in kline_data:
            #                 print(f"Error fetching kline data for {symbol}: {kline_data['error']}")
            #                 continue
                        
            #             vwap_value = get_vwap(kline_data)
            #             close_price = float(kline_data[-1][4])  # Latest closing price
                        
            #             print(f"{symbol} | VWAP: {vwap_value} | Close Price: {close_price} | Position: {position}")
                        
            #             # Evaluate conditions to keep or close the position
            #             if position == "long":
            #                 if close_price > vwap_value:
            #                     print(f"{symbol}: Close price is higher than VWAP for long position. Keeping the position open.")
            #                     continue  # Keep the position open and proceed to the next market
            #                 else:
            #                     # Close the position if condition is not met
            #                     order_response = place_order(symbol=symbol, qty=qty, side="Sell")
            #                     print(f"VWAP Stop-Loss Order Response for {symbol}: {order_response}")
            #                     market["status"] = "closed"
            #                     save_markets_to_file(markets)

            #             elif position == "short":
            #                 if close_price < vwap_value:
            #                     print(f"{symbol}: Close price is lower than VWAP for short position. Keeping the position open.")
            #                     continue  # Keep the position open and proceed to the next market
            #                 else:
            #                     # Close the position if condition is not met
            #                     order_response = place_order(symbol=symbol, qty=qty, side="Buy")
            #                     print(f"VWAP Stop-Loss Order Response for {symbol}: {order_response}")
            #                     market["status"] = "closed"
            #                     save_markets_to_file(markets)   
            
            # elif now_pht.hour == LONDON_END and 0 <= now_pht.minute <= 2 and not ALL_SESSION_STRAT:
                
            #     print("London session ending soon. Calculating VWAP and evaluating positions.")

            #     for market in markets:
            #         if market["status"] == "open" and market.get("mark_close", False):
            #             symbol = market["symbol"]
            #             position = market["position"]
            #             qty = market["qty"]

            #             # Fetch kline data using Tokyo session epochs
            #             kline_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=LONDON_START_EPOCH, end=LONDON_END_EPOCH)
            #             if "error" in kline_data:
            #                 print(f"Error fetching kline data for {symbol}: {kline_data['error']}")
            #                 continue
                        
            #             vwap_value = get_vwap(kline_data)
            #             close_price = float(kline_data[-1][4])  # Latest closing price
                        
            #             print(f"{symbol} | VWAP: {vwap_value} | Close Price: {close_price} | Position: {position}")
                        
            #             # Evaluate conditions to keep or close the position
            #             if position == "long":
            #                 if close_price > vwap_value:
            #                     print(f"{symbol}: Close price is higher than VWAP for long position. Keeping the position open.")
            #                     continue  # Keep the position open and proceed to the next market
            #                 else:
            #                     # Close the position if condition is not met
            #                     order_response = place_order(symbol=symbol, qty=qty, side="Sell")
            #                     print(f"VWAP Stop-Loss Order Response for {symbol}: {order_response}")
            #                     market["status"] = "closed"
            #                     save_markets_to_file(markets)

            #             elif position == "short":
            #                 if close_price < vwap_value:
            #                     print(f"{symbol}: Close price is lower than VWAP for short position. Keeping the position open.")
            #                     continue  # Keep the position open and proceed to the next market
            #                 else:
            #                     # Close the position if condition is not met
            #                     order_response = place_order(symbol=symbol, qty=qty, side="Buy")
            #                     print(f"VWAP Stop-Loss Order Response for {symbol}: {order_response}")
            #                     market["status"] = "closed"
            #                     save_markets_to_file(markets)   

            # DAY TRADE SESSION CLOSE
            if session == "New York" and now_pht.hour == NY_END - 1 and now_pht.minute >= 58:
                print("New York session ending soon. Closing all remaining trades.")
                close_all_trades(markets)

        except Exception as e:
            print(f"An error occurred: {str(e)}")

        time.sleep(LOOP_INTERVAL)

if __name__ == "__main__":
    print("Starting Trading Bot...")
    trading_bot()
