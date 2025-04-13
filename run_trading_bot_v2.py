import time
import csv
from pybit.unified_trading import HTTP
import numpy as np
from datetime import datetime
import pytz
from atr_indicator import calculate_atr
from calculate_mean import calculate_mean_close
from calculate_risk_order import calculate_order_size
from get_high_lows import get_extreme_value
from get_market_trend import get_market_trendline_slope
from get_session_epoch import get_trading_session_epochs, get_yesterday_trading_session_epochs
from kline_utils import get_kline_data  # Import reusable kline function
from rsi_utils import compute_rsi       # Import reusable RSI function
from order_utils import place_order, place_order_return_qty     # Import reusable place order function
import json
import os
import sys

from vwap_indicator import get_vwap
# CSV file to store market data
MARKET_FILE = "markets2.csv"

# Bot configuration
RSI_PERIOD = 12
INTERVAL = 5
LOOP_INTERVAL = 12  # Seconds
pht_timezone = pytz.timezone("Asia/Manila")

RISK_AMOUNT = 2

# Toggle True or False for session specific behavior
ALL_SESSION_STRAT = False
OPEN_NEW_TRADE = True
# Session Time Ranges (in PHT)
SYDNEY_START = 5
SYDNEY_END = 14
TOKYO_START = 7
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
NEWYORK_START_EPOCH = session_data["ny"]["start_epoch"]
NEWYORK_END_EPOCH = session_data["ny"]["end_epoch"]


# Load session epochs directly
try:
    with open("sessions_yesterday.json", "r") as file:
        session_yesterday_data = json.load(file)
except Exception as e:
    print(f"Error loading session data: {e}")
    session_data = {}

# Check if Tokyo session data is available
if "tokyo" not in session_data:
    print("Tokyo session data not found in sessions.json.")
    

TOKYO_YESTERDAY_START_EPOCH = session_yesterday_data["tokyo"]["start_epoch"]
TOKYO_YESTERDAY_END_EPOCH = session_yesterday_data["tokyo"]["end_epoch"]
SYDNEY_YESTERDAY_START_EPOCH = session_yesterday_data["sydney"]["start_epoch"]
SYDNEY_YESTERDAY_END_EPOCH = session_yesterday_data["sydney"]["end_epoch"]
LONDON_YESTERDAY_START_EPOCH = session_yesterday_data["london"]["start_epoch"]
LONDON_YESTERDAY_END_EPOCH = session_yesterday_data["london"]["end_epoch"]
NEWYORK_YESTERDAY_START_EPOCH = session_yesterday_data["ny"]["start_epoch"]
NEWYORK_YESTERDAY_END_EPOCH = session_yesterday_data["ny"]["end_epoch"]

def restart_script():
    """Restart the script as if it was closed and reopened."""
    print("Restarting script...")
    python = sys.executable
    os.execv(python, [python] + sys.argv)

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
                    "mark_close": row["mark_close"] == "True",
                    "reversed": row['reversed'] == "True"
                })
    except FileNotFoundError:
        print(f"{MARKET_FILE} not found. Starting with an empty market list.")
    return markets

def save_markets_to_file(markets):
    """Save the updated market data to the CSV file."""
    fieldnames = ["symbol", "qty", "position", "status", "stop_loss", "mark_close","reversed"]
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
                    "mark_close": market["mark_close"],
                    "reversed": market["reversed"]
                })
        print("Markets successfully saved to file.")
    except Exception as e:
        print(f"Error saving markets to file: {e}")


def determine_session(now_pht):
    """Determine the current trading session based on PHT time."""
    if SYDNEY_START <= now_pht.hour < SYDNEY_END:
        return "sydney"
    elif TOKYO_START <= now_pht.hour < TOKYO_END:
        return "tokyo"
    elif LONDON_START <= now_pht.hour < LONDON_END:
        return "london"
    elif now_pht.hour >= NY_START or now_pht.hour < NY_END:
        return "new_york"
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
            # if not check_open_positions(markets):
            #     print("No open positions left. Stopping the trading bot.")
            #     break  

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


            # print("Saving the following markets data to file:")
            # print(markets)
           

            for market in markets:

                now_pht = datetime.now(pht_timezone)
                session = determine_session(now_pht)
                print('current session:', session)

                symbol = market["symbol"]
                qty = market["qty"]
                position = market["position"]
                stop_loss = market["stop_loss"]
                reversed_trade = market['reversed']

                # if isinstance(reversed_trade, str):
                #     print("The data is a string.")
                # elif isinstance(reversed_trade, bool):
                #     print("The data is a boolean.")
                # else:
                #     print("The data is neither a string nor a boolean.")

                # if reversed_trade == True:
                #     print(111111111111111111111)
                # elif reversed_trade == False:
                #     print(222222222222222222222)


                kline_data = get_kline_data(symbol=symbol, interval=INTERVAL)
                if "error" in kline_data:
                    print(f"Error fetching kline data for {symbol}: {kline_data['error']}")
                    continue

                average_true_range = calculate_atr(kline_data)

                # if is_five_minute_mark():
                #     # Compute trendline slope
                #     kline_session_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=TOKYO_START_EPOCH,end=TOKYO_END_EPOCH)
                #     if "error" in kline_session_data:
                #         print(f"Error fetching kline data for {symbol}: {kline_session_data['error']}")
                #         continue

                #     trendline_slope = get_market_trendline_slope(kline_session_data)
                #     print(f"Market: {symbol}, Trendline Slope: {trendline_slope}")

                #     mean_close = calculate_mean_close(kline_session_data)
                #     print(f"Market: {symbol}, Mean Close: {mean_close}")

                current_price = float(kline_data[-1][4])

                rsi_value = compute_rsi(data=kline_data, period=RSI_PERIOD)

                if isinstance(rsi_value, dict) and "error" in rsi_value:
                    print(f"Error calculating RSI for {symbol}: {rsi_value['error']}")
                    continue

                print(f"Market: {symbol}, Price: {current_price}, RSI: {rsi_value}, Position: {position}, Stop Loss: {stop_loss} ")

                if market["status"] == "closed" and OPEN_NEW_TRADE == True:

                    print(symbol,'is closed looking for entry')
                    
                    if position == "long":

                        if session == "sydney":

                            kline_session_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=NEWYORK_YESTERDAY_START_EPOCH, end=NEWYORK_YESTERDAY_END_EPOCH)
                            mean_close = calculate_mean_close(kline_session_data) - average_true_range
                            print('current price:',current_price, 'mean close:',mean_close)

                            if current_price < mean_close:
                                
                                sl = get_extreme_value(market=symbol,start= NEWYORK_YESTERDAY_START_EPOCH, end= NEWYORK_YESTERDAY_END_EPOCH, position_type="short") + average_true_range
                                market['stop_loss'] = sl
                                order_value_entry = calculate_order_size(current_price=current_price,stop_price=sl,risk_amount=RISK_AMOUNT)
                                order_response = place_order_return_qty(symbol=symbol, usdt=order_value_entry, side="Sell")
                                market['status'] = "open"
                                market['reversed'] = False
                                market['qty'] = order_response
                                market['position'] = "short"
                                save_markets_to_file(markets)
                                continue

                        if session == "tokyo":

                            kline_session_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=SYDNEY_START_EPOCH, end=SYDNEY_END_EPOCH)
                            mean_close = calculate_mean_close(kline_session_data) - average_true_range
                            print('current price:',current_price, 'mean close:',mean_close)
                            

                            if current_price < mean_close:
                                
                                sl = get_extreme_value(market=symbol,start= SYDNEY_START_EPOCH, end= SYDNEY_END_EPOCH, position_type="short") + average_true_range
                                market['stop_loss'] = sl
                                order_value_entry = calculate_order_size(current_price=current_price,stop_price=sl,risk_amount=RISK_AMOUNT)
                                order_response = place_order_return_qty(symbol=symbol, usdt=order_value_entry, side="Sell")
                                market['status'] = "open"
                                market['reversed'] = False
                                market['qty'] = order_response
                                market['position'] = "short"
                                save_markets_to_file(markets)
                                continue
                                
                        elif session == "london":

                            kline_session_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=TOKYO_START_EPOCH, end=TOKYO_END_EPOCH)
                            mean_close = calculate_mean_close(kline_session_data) + average_true_range
                            print('current price:',current_price, 'mean close:',mean_close)

                            if current_price < mean_close:
                                
                                sl = get_extreme_value(market=symbol,start= TOKYO_START_EPOCH, end= TOKYO_END_EPOCH, position_type="short") + average_true_range
                                market['stop_loss'] = sl
                                order_value_entry = calculate_order_size(current_price=current_price,stop_price=sl,risk_amount=RISK_AMOUNT)
                                order_response = place_order_return_qty(symbol=symbol, usdt=order_value_entry, side="Sell")
                                market['status'] = "open"
                                market['reversed'] = False
                                market['qty'] = order_response
                                market['position'] = "short"
                                save_markets_to_file(markets)
                                continue

                        elif session == "new_york":

                            kline_session_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=LONDON_START_EPOCH, end=LONDON_END_EPOCH)
                            mean_close = calculate_mean_close(kline_session_data) + average_true_range
                            print('current price:',current_price, 'mean close:',mean_close)

                            if current_price < mean_close:
                                
                                sl = get_extreme_value(market=symbol,start= LONDON_START_EPOCH, end= LONDON_END_EPOCH, position_type="short") + average_true_range
                                market['stop_loss'] = sl
                                order_value_entry = calculate_order_size(current_price=current_price,stop_price=sl,risk_amount=RISK_AMOUNT)
                                order_response = place_order_return_qty(symbol=symbol, usdt=order_value_entry, side="Sell")
                                market['status'] = "open"
                                market['reversed'] = False
                                market['qty'] = order_response
                                market['position'] = "short"
                                save_markets_to_file(markets)
                                continue

                    elif position == "short":

                        if session == "sydney":

                            kline_session_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=NEWYORK_YESTERDAY_START_EPOCH, end=NEWYORK_YESTERDAY_END_EPOCH)
                            mean_close = calculate_mean_close(kline_session_data) + average_true_range
                            print('current price:',current_price, 'mean close:',mean_close)

                            if current_price > mean_close:
                                
                                sl = get_extreme_value(market=symbol,start= NEWYORK_YESTERDAY_START_EPOCH, end= NEWYORK_YESTERDAY_END_EPOCH, position_type="long") - average_true_range
                                print(sl)
                                market['stop_loss'] = sl
                                order_value_entry = calculate_order_size(current_price=current_price,stop_price=sl,risk_amount=RISK_AMOUNT)
                                order_response = place_order_return_qty(symbol=symbol, usdt=order_value_entry, side="Buy")
                                market['status'] = "open"
                                market['reversed'] = False
                                market['qty'] = order_response
                                market['position'] = "long"
                                save_markets_to_file(markets)
                                continue

                        if session == "tokyo":
                            
                            kline_session_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=SYDNEY_START_EPOCH, end=SYDNEY_END_EPOCH)
                            mean_close = calculate_mean_close(kline_session_data) + average_true_range
                            print('current price:',current_price, 'mean close:',mean_close)
                            print(current_price > mean_close)

                            if current_price > mean_close:

                                sl = get_extreme_value(market=symbol,start= SYDNEY_START_EPOCH, end= SYDNEY_END_EPOCH, position_type="long") - average_true_range
                                market['stop_loss'] = sl
                                order_value_entry = calculate_order_size(current_price=current_price,stop_price=sl,risk_amount=RISK_AMOUNT)
                                order_response = place_order_return_qty(symbol=symbol, usdt=order_value_entry, side="Buy")
                                market['status'] = "open"
                                market['reversed'] = False
                                market['qty'] = order_response
                                market['position'] = "long"
                                print('###################')
                                print(markets)
                                save_markets_to_file(markets)
                                continue


                        elif session == "london":

                            kline_session_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=TOKYO_START_EPOCH, end=TOKYO_END_EPOCH)
                            mean_close = calculate_mean_close(kline_session_data) + average_true_range
                            print('current price:',current_price, 'mean close:',mean_close)

                            if current_price > mean_close:
                                
                                sl = get_extreme_value(market=symbol,start= TOKYO_START_EPOCH, end= TOKYO_END_EPOCH, position_type="long") - average_true_range
                                market['stop_loss'] = sl
                                order_value_entry = calculate_order_size(current_price=current_price,stop_price=sl,risk_amount=RISK_AMOUNT)
                                order_response = place_order_return_qty(symbol=symbol, usdt=order_value_entry, side="Buy")
                                market['status'] = "open"
                                market['reversed'] = False
                                market['qty'] = order_response
                                market['position'] = "long"
                                save_markets_to_file(markets)
                                continue
                                

                        elif session == "new_york":

                            kline_session_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=LONDON_START_EPOCH, end=LONDON_END_EPOCH)
                            mean_close = calculate_mean_close(kline_session_data) + average_true_range
                            print('current price:',current_price, 'mean close:',mean_close)

                            if current_price > mean_close:
                                
                                sl = get_extreme_value(market=symbol,start= LONDON_START_EPOCH, end= LONDON_END_EPOCH, position_type="long") - average_true_range
                                market['stop_loss'] = sl
                                order_value_entry = calculate_order_size(current_price=current_price,stop_price=sl,risk_amount=RISK_AMOUNT)
                                order_response = place_order_return_qty(symbol=symbol, usdt=order_value_entry, side="Buy")
                                market['status'] = "open"
                                market['reversed'] = False
                                market['qty'] = order_response
                                market['position'] = "long"
                                save_markets_to_file(markets)
                                continue

                # STOPLOSS CHECK EXECUTING STOPLOSS 
                if market['status'] == "closed":
                    print(f"Market for {symbol} is closed. Skipping stop-loss watcb.")
                
                elif market['status'] == "open":
                    if (position == "short" and current_price > stop_loss) or \
                    (position == "long" and current_price < stop_loss):
                        side = "Buy" if position == "short" else "Sell"
                        print(f"Price hit stop-loss for {symbol}. Closing position.")

                        if reversed_trade == True:
                            
                            decimal_places = len(qty.split(".")[1]) if "." in qty else 0
                            qty_numeric = float(qty) * 2
                            qty_final = f"{qty_numeric:.{decimal_places}f}"
                            print("qty is:",qty_final)
                            print('reversed trade!',reversed_trade)
                            order_response = place_order(symbol=symbol, qty=qty_final, side=side)
                            print(f"Stop-Loss Order Response for {symbol}: {order_response}")
                            
                            if side == "Sell":

                                market['position'] = "short"
                                market['reversed'] = False

                                if session == "sydney":
                                    market['stop_loss'] = get_extreme_value(market=symbol,start= NEWYORK_YESTERDAY_START_EPOCH, end= NEWYORK_YESTERDAY_END_EPOCH, position_type="short") + average_true_range
                                    save_markets_to_file(markets)
                                elif session == "tokyo":
                                    market['stop_loss'] = get_extreme_value(market=symbol,start=SYDNEY_START_EPOCH, end= SYDNEY_END_EPOCH,position_type="short") + average_true_range
                                    save_markets_to_file(markets)
                                elif session == "london":
                                    market['stop_loss'] = get_extreme_value(market=symbol,start=TOKYO_START_EPOCH, end= TOKYO_END_EPOCH,position_type="short") + average_true_range
                                    save_markets_to_file(markets)
                                elif session == "new_york":
                                    market['stop_loss'] = get_extreme_value(market=symbol,start=LONDON_START_EPOCH, end= LONDON_END_EPOCH,position_type="short") + average_true_range
                                    save_markets_to_file(markets)

                            elif side == "Buy":

                                market['position'] = "long"
                                market['reversed'] = False

                                if session == "sydney":
                                    market['stop_loss'] = get_extreme_value(market=symbol,start=NEWYORK_YESTERDAY_START_EPOCH, end= NEWYORK_YESTERDAY_END_EPOCH, position_type="long") - average_true_range
                                    save_markets_to_file(markets)
                                elif session == "tokyo":
                                    market['stop_loss'] = get_extreme_value(market=symbol,start=SYDNEY_START_EPOCH, end= SYDNEY_END_EPOCH,position_type="long") - average_true_range
                                    save_markets_to_file(markets)
                                elif session == "london":
                                    market['stop_loss'] = get_extreme_value(market=symbol,start=TOKYO_START_EPOCH, end= TOKYO_END_EPOCH, position_type="long") - average_true_range
                                    save_markets_to_file(markets)
                                elif session == "new_york":
                                    market['stop_loss'] = get_extreme_value(market=symbol,start=LONDON_START_EPOCH, end= LONDON_END_EPOCH,position_type="long") - average_true_range
                                    save_markets_to_file(markets)
                                
                            continue

                        elif reversed_trade == False:

                            print('stop loss trade!',reversed_trade)
                            order_response = place_order(symbol=symbol, qty=qty, side=side)
                            print(f"Stop-Loss Order Response for {symbol}: {order_response}")
                            market["status"] = "closed"
                            market["reversed"] = False
                            save_markets_to_file(markets)
                            continue                       

                # STOP LOSS BEHAVIOR DEPENDING ON STRATEGY FOR THE DAY
                if ALL_SESSION_STRAT and market["status"] == "open":
                    # Run the same logic as London and new_york sessions for all sessions
                    if position == "short" and rsi_value < 30:
                        new_stop_loss = get_highest_high(kline_data, TRAILING_STOP_CANDLE_COUNT)
                        if new_stop_loss != stop_loss:
                            print(f"Updating trailing stop-loss for {symbol} to {new_stop_loss} (All session).")
                            market["stop_loss"] = new_stop_loss
                            market["reversed"] = False
                            save_markets_to_file(markets)
                            continue

                    elif position == "long" and rsi_value > 70:
                        new_stop_loss = get_lowest_low(kline_data, TRAILING_STOP_CANDLE_COUNT)
                        if new_stop_loss != stop_loss:
                            print(f"Updating trailing stop-loss for {symbol} to {new_stop_loss} (All session).")
                            market["stop_loss"] = new_stop_loss
                            market["reversed"] = False
                            save_markets_to_file(markets)
                            continue
                
                elif not ALL_SESSION_STRAT and market["status"] == "open":
                    # Run specific session-based logic if ALL_SESSION_STRAT is False
                    if session == "tokyo":
                        if position == "short" and rsi_value < 30:
                            print(f"RSI hit in Tokyo for {symbol}. Marking for closure.")
                            market["mark_close"] = True
                            save_markets_to_file(markets)
                            continue

                        elif position == "long" and rsi_value > 70:
                            print(f"RSI hit in Tokyo for {symbol}. Marking for closure.")
                            market["mark_close"] = True
                            save_markets_to_file(markets)
                            continue

                    # if session == "London" or now_pht.hour == 15 and 0 <= now_pht.minute <= 2:
                    if (session == "london") or (session == "tokyo" and (15 <= now_pht.hour < 17 or (now_pht.hour == 17 and now_pht.minute == 0))):

                        if position == "short" and rsi_value < 30:
                            new_stop_loss = get_highest_high(kline_data, TRAILING_STOP_CANDLE_COUNT)
                            if new_stop_loss != stop_loss:
                                print(f"Updating trailing stop-loss for {symbol} to {new_stop_loss} (London session).")
                                market["stop_loss"] = new_stop_loss
                                market["reversed"] = False
                                save_markets_to_file(markets)
                                continue

                        elif position == "long" and rsi_value > 70:
                            new_stop_loss = get_lowest_low(kline_data, TRAILING_STOP_CANDLE_COUNT)
                            if new_stop_loss != stop_loss:
                                print(f"Updating trailing stop-loss for {symbol} to {new_stop_loss} (London session).")
                                market["stop_loss"] = new_stop_loss
                                market["reversed"] = False
                                save_markets_to_file(markets)
                                continue

                    if session == "new_york":

                        if position == "short" and rsi_value < 30:
                            new_stop_loss = get_highest_high(kline_data, TRAILING_STOP_CANDLE_COUNT)
                            if new_stop_loss != stop_loss:
                                print(f"Updating trailing stop-loss for {symbol} to {new_stop_loss} (new_york session).")
                                market["stop_loss"] = new_stop_loss
                                market["reversed"] = False
                                save_markets_to_file(markets)
                                continue

                        elif position == "long" and rsi_value > 70:
                            new_stop_loss = get_lowest_low(kline_data, TRAILING_STOP_CANDLE_COUNT)
                            if new_stop_loss != stop_loss:
                                print(f"Updating trailing stop-loss for {symbol} to {new_stop_loss} (new_york session).")
                                market["stop_loss"] = new_stop_loss
                                market["reversed"] = False
                                save_markets_to_file(markets)
                                continue
            
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

                                klines = get_kline_data(symbol, interval=INTERVAL)
                                average_true_range = calculate_atr(klines)
                                market["stop_loss"] = mean_close - average_true_range  # Update stop loss in the market object
                                market["reversed"] = True
                                print(f"Stop loss for {symbol} (long) moved to: {mean_close}")
                                save_markets_to_file(markets)
                                
                            else:
                                print(f"No change to stop loss for {symbol} (long). New stop loss ({mean_close}) is lower than current ({current_stop_loss}).")

                        elif position == "short":
                            # Move stop loss down only if the new stop loss is closer (lower than the current one)
                            if mean_close < current_stop_loss:

                                klines = get_kline_data(symbol, interval=INTERVAL)
                                average_true_range = calculate_atr(klines)
                                market["stop_loss"] = mean_close + average_true_range  # Update stop loss in the market object
                                market["reversed"] = True
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
                                klines = get_kline_data(symbol, interval=INTERVAL)
                                average_true_range = calculate_atr(klines)
                                market["stop_loss"] = mean_close - average_true_range  # Update stop loss in the market object
                                market["reversed"] = True
                                print(f"Stop loss for {symbol} (long) moved to: {mean_close}")
                                save_markets_to_file(markets)

                                
                            else:
                                print(f"No change to stop loss for {symbol} (long). New stop loss ({mean_close}) is lower than current ({current_stop_loss}).")

                        elif position == "short":
                            # Move stop loss down only if the new stop loss is closer (lower than the current one)
                            if mean_close < current_stop_loss:
                                klines = get_kline_data(symbol, interval=INTERVAL)
                                average_true_range = calculate_atr(klines)
                                market["stop_loss"] = mean_close + average_true_range  # Update stop loss in the market object
                                market["reversed"] = True
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
                                klines = get_kline_data(symbol, interval=INTERVAL)
                                average_true_range = calculate_atr(klines)
                                market["stop_loss"] = mean_close - average_true_range # Update stop loss in the market object
                                market["reversed"] = True
                                print(f"Stop loss for {symbol} (long) moved to: {mean_close}")
                                save_markets_to_file(markets)

                                
                            else:
                                print(f"No change to stop loss for {symbol} (long). New stop loss ({mean_close}) is lower than current ({current_stop_loss}).")

                        elif position == "short":
                            # Move stop loss down only if the new stop loss is closer (lower than the current one)
                            if mean_close < current_stop_loss:
                                klines = get_kline_data(symbol, interval=INTERVAL)
                                average_true_range = calculate_atr(klines)
                                market["stop_loss"] = mean_close + average_true_range # Update stop loss in the market object
                                market["reversed"] = True
                                print(f"Stop loss for {symbol} (short) moved to: {mean_close}")
                                save_markets_to_file(markets)
                            else:
                                print(f"No change to stop loss for {symbol} (short). New stop loss ({mean_close}) is higher than current ({current_stop_loss}).")

            elif now_pht.hour == NY_END and 0 <= now_pht.minute <= 2 and not ALL_SESSION_STRAT:
                  
                  for market in markets:
                    if market["status"] == "open":
                        symbol = market["symbol"]
                        position = market["position"]  # "long" or "short"
                        current_stop_loss = market["stop_loss"]

                        # Fetch Tokyo session data for the current market
                        kline_session_data = get_kline_data(
                            symbol=symbol, interval=INTERVAL, start=NEWYORK_START_EPOCH, end=NEWYORK_END_EPOCH
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
                                market["stop_loss"] = mean_close - average_true_range # Update stop loss in the market object
                                market["reversed"] = True
                                print(f"Stop loss for {symbol} (long) moved to: {mean_close}")
                                save_markets_to_file(markets)

                                
                            else:
                                print(f"No change to stop loss for {symbol} (long). New stop loss ({mean_close}) is lower than current ({current_stop_loss}).")

                        elif position == "short":
                            # Move stop loss down only if the new stop loss is closer (lower than the current one)
                            if mean_close < current_stop_loss:
                                market["stop_loss"] = mean_close + average_true_range # Update stop loss in the market object
                                market["reversed"] = True
                                print(f"Stop loss for {symbol} (short) moved to: {mean_close}")
                                save_markets_to_file(markets)

                            else:
                                print(f"No change to stop loss for {symbol} (short). New stop loss ({mean_close}) is higher than current ({current_stop_loss}).")


            # DAY TRADE SESSION CLOSE
            if session == "new_york" and now_pht.hour == NY_END - 2 and now_pht.minute >= 58:
                print("Pausing for 4 minutes before restarting...")
                get_yesterday_trading_session_epochs()
                get_trading_session_epochs()
                time.sleep(240)  # Sleep for 4 minutes (240 seconds)
                restart_script()  # Restart the script

        except Exception as e:
            print(f"An error occurred: {str(e)}")

        time.sleep(LOOP_INTERVAL)

if __name__ == "__main__":
    print("Starting Trading Bot...")
    trading_bot()
