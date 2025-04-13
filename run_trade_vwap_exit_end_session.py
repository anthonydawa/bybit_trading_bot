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
from helper_functions import count_open_symbols
from kline_utils import get_kline_data  # Import reusable kline function
from rsi_utils import compute_rsi       # Import reusable RSI function
from order_utils import place_order, place_order_return_qty     # Import reusable place order function
import json
import os
import sys

from vwap_indicator import get_vwap
# CSV file to store market data
MARKET_FILE = "markets_vwap_exit_end_session.csv"

# Bot configuration
RSI_PERIOD = 12
INTERVAL = 5
LOOP_INTERVAL = 12  # Seconds
pht_timezone = pytz.timezone("Asia/Manila")

RISK_AMOUNT = 1
LIMIT_OPEN_TRADES = 18


# Toggle True or False for session specific behavior
ALL_SESSION_STRAT = True
OPEN_NEW_TRADE = False
VWAP_STRAT = True
EXIT_SESSION = 'ny'

# Session Time Ranges (in PHT)
SYDNEY_START = 6
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
NEWYORK_START_EPOCH = session_data["ny"]["start_epoch"]
NEWYORK_END_EPOCH = session_data["ny"]["end_epoch"]


# Load session epochs directly
try:
    with open("sessions_yesterday.json", "r") as file:
        session_yesterday_data = json.load(file)
except Exception as e:
    print(f"Error loading session data: {e}")
    session_yesterday_data = {}

# Check if Tokyo session data is available
if "tokyo" not in session_yesterday_data:
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
                    "reversed": row['reversed'] == "True",
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



def trading_bot(NUM_MARKETS=None):

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
            if NUM_MARKETS is not None:
                active_positions = sum(1 for market in markets if market["status"] == "open")
                if active_positions < 0.3 * NUM_MARKETS:
                    print(f"Active positions ({active_positions}) are less than 30% of total markets ({NUM_MARKETS}). Closing all trades.")
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
                reversed_trade = market["reversed"]

                kline_data = get_kline_data(symbol=symbol, interval=INTERVAL)
                if "error" in kline_data:
                    print(f"Error fetching kline data for {symbol}: {kline_data['error']}")
                    continue

                current_price = float(kline_data[-1][4])
                rsi_value = compute_rsi(data=kline_data, period=RSI_PERIOD)

                if isinstance(rsi_value, dict) and "error" in rsi_value:
                    print(f"Error calculating RSI for {symbol}: {rsi_value['error']}")
                    continue

                print(f"Market: {symbol}, Price: {current_price}, RSI: {rsi_value}, Position: {position}, Stop Loss: {stop_loss} ")
                
                current_open_markets = count_open_symbols(MARKET_FILE)
                print('current open trades:', current_open_markets)

                #closing trade if vwap crossed 
                if VWAP_STRAT == True and market['status'] == "open":

                    if 5 <= now_pht.hour <= 17:  

                        print('session is asian')

                        kline_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=SYDNEY_START_EPOCH, end=TOKYO_END_EPOCH)

                        if "error" in kline_data:
                            print(f"Error fetching kline data for {symbol}: {kline_data['error']}")
                            continue
                        
                        vwap_value = get_vwap(kline_data)

                        print('vwap exit strat')
                        print('vwap:',vwap_value,'current price:', current_price)

                        if (position == "short" and current_price > vwap_value) or \
                            (position == "long" and current_price < vwap_value):

                            print("checking price cross stoploss", market['symbol'])

                            side = "Buy" if position == "short" else "Sell"
                            
                            print(f"Price hit stop-loss for {symbol}. Closing position.")
                            order_response = place_order(symbol=symbol, qty=qty, side=side)

                            # Ensure API success before updating market status
                            if order_response and order_response.get("retCode") == 0:
                                print(f"Stop-Loss Order Success for {symbol}: {order_response}")
                                market["status"] = "closed"
                                market["reversed"] = True
                                save_markets_to_file(markets)
                            else:
                                error_msg = order_response.get("retMsg", "Unknown error")
                                print(f"Stop-Loss Order Failed for {symbol}: {error_msg}")
                            continue     
                    
                    elif 15 <= now_pht.hour or now_pht.hour == 0:  

                        print('session is london')

                        kline_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=LONDON_START_EPOCH, end=LONDON_END_EPOCH)

                        if "error" in kline_data:
                            print(f"Error fetching kline data for {symbol}: {kline_data['error']}")
                            continue
                        
                        vwap_value = get_vwap(kline_data)

                        print('vwap exit strat')
                        print('vwap:',vwap_value,'current price:', current_price)

                        if (position == "short" and current_price > vwap_value) or \
                            (position == "long" and current_price < vwap_value):

                            print("checking price cross stoploss", market['symbol'])

                            side = "Buy" if position == "short" else "Sell"
                            
                            print(f"Price hit stop-loss for {symbol}. Closing position.")
                            order_response = place_order(symbol=symbol, qty=qty, side=side)

                            # Ensure API success before updating market status
                            if order_response and order_response.get("retCode") == 0:
                                print(f"Stop-Loss Order Success for {symbol}: {order_response}")
                                market["status"] = "closed"
                                market["reversed"] = True
                                save_markets_to_file(markets)
                            else:
                                error_msg = order_response.get("retMsg", "Unknown error")
                                print(f"Stop-Loss Order Failed for {symbol}: {error_msg}")
                            continue     

                    elif 21 <= now_pht.hour or 0 <= now_pht.hour <= 6:  
                        print('session is NY')
                        kline_data = get_kline_data(symbol=symbol, interval=INTERVAL, start=NEWYORK_START_EPOCH, end=NEWYORK_END_EPOCH)

                        if "error" in kline_data:
                            print(f"Error fetching kline data for {symbol}: {kline_data['error']}")
                            continue
                        
                        vwap_value = get_vwap(kline_data)

                        print('vwap exit strat')
                        print('vwap:',vwap_value,'current price:', current_price)

                        if (position == "short" and current_price > vwap_value) or \
                            (position == "long" and current_price < vwap_value):

                            print("checking price cross stoploss", market['symbol'])

                            side = "Buy" if position == "short" else "Sell"
                            
                            print(f"Price hit stop-loss for {symbol}. Closing position.")
                            order_response = place_order(symbol=symbol, qty=qty, side=side)

                            # Ensure API success before updating market status
                            if order_response and order_response.get("retCode") == 0:
                                print(f"Stop-Loss Order Success for {symbol}: {order_response}")
                                market["status"] = "closed"
                                market["reversed"] = True
                                save_markets_to_file(markets)
                            else:
                                error_msg = order_response.get("retMsg", "Unknown error")
                                print(f"Stop-Loss Order Failed for {symbol}: {error_msg}")
                            continue     
                
                if EXIT_SESSION == "tokyo":

                    if now_pht.hour == 17 and 0 <= now_pht.minute:

                        if (position == "short") or \
                            (position == "long"):

                            print("checking price cross stoploss", market['symbol'])

                            side = "Buy" if position == "short" else "Sell"
                            
                            print(f"Price hit stop-loss for {symbol}. Closing position.")
                            order_response = place_order(symbol=symbol, qty=qty, side=side)

                            # Ensure API success before updating market status
                            if order_response and order_response.get("retCode") == 0:
                                print(f"Stop-Loss Order Success for {symbol}: {order_response}")
                                market["status"] = "closed"
                                market["reversed"] = True
                                save_markets_to_file(markets)
                            else:
                                error_msg = order_response.get("retMsg", "Unknown error")
                                print(f"Stop-Loss Order Failed for {symbol}: {error_msg}")
                            continue    

                elif EXIT_SESSION == "london":

                    if now_pht.hour == 0 and 0 <= now_pht.minute:

                        if (position == "short") or \
                            (position == "long"):

                            print("checking price cross stoploss", market['symbol'])

                            side = "Buy" if position == "short" else "Sell"
                            
                            print(f"Price hit stop-loss for {symbol}. Closing position.")
                            order_response = place_order(symbol=symbol, qty=qty, side=side)

                            # Ensure API success before updating market status
                            if order_response and order_response.get("retCode") == 0:
                                print(f"Stop-Loss Order Success for {symbol}: {order_response}")
                                market["status"] = "closed"
                                market["reversed"] = True
                                save_markets_to_file(markets)
                            else:
                                error_msg = order_response.get("retMsg", "Unknown error")
                                print(f"Stop-Loss Order Failed for {symbol}: {error_msg}")
                            continue      

                elif EXIT_SESSION == "ny":

                    if now_pht.hour == 6 and 0 <= now_pht.minute:

                        if (position == "short") or \
                            (position == "long"):

                            print("checking price cross stoploss", market['symbol'])

                            side = "Buy" if position == "short" else "Sell"
                            
                            print(f"Price hit stop-loss for {symbol}. Closing position.")
                            order_response = place_order(symbol=symbol, qty=qty, side=side)

                            # Ensure API success before updating market status
                            if order_response and order_response.get("retCode") == 0:
                                print(f"Stop-Loss Order Success for {symbol}: {order_response}")
                                market["status"] = "closed"
                                market["reversed"] = True
                                save_markets_to_file(markets)
                            else:
                                error_msg = order_response.get("retMsg", "Unknown error")
                                print(f"Stop-Loss Order Failed for {symbol}: {error_msg}")
                            continue    
                

                # exit loop if not active trades left
                if current_open_markets == 0:
                    sys.exit()

        except Exception as e:
            print(f"An error occurred: {str(e)}")

        time.sleep(LOOP_INTERVAL)

if __name__ == "__main__":
    print("Starting Trading Bot...")
    
    # RISK_AMOUNT = 2
    # LIMIT_OPEN_TRADES = 16
    # ALL_SESSION_STRAT = False
    # OPEN_NEW_TRADE = True
    trading_bot()