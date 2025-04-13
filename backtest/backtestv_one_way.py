from collections import deque
import time
import csv
from collections import deque
import time
from backtestv1_functions import get_active_sessions, get_highest_high, get_highest_high_lowest_low, get_lowest_low, get_market_trendline_slope, get_mean_close, get_vwap, load_data_from_file, convert_to_pht, get_rsi, get_atr


market = "LUCEUSDT"     
data = load_data_from_file(f'backtest/historical_klines/{market}_5m_historical_data.json')         
pnl_file = 'pnl_progression.csv'
# Define trading fee percentage (0.11% total for both entry and exit)
trading_fee = 0.11 / 100  # 0.11%
CANDLE_CLOSE = 2
CC_STRAT = False
OPEN_STRAT = False

save_file = f'current_status_{market}.csv'
# Clear the save file
with open(save_file, 'w') as file:
    file.truncate(0)  # Clears the file content
# headers for the save file
with open(save_file, 'a', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(['Timestamp', 'PnL', 'Win Count', 'Loss Count', 'Position', 'Entry', 'Stoploss', 'Stage'])  # Add the PnL value for this trade


with open(pnl_file, 'w') as file:
    file.truncate(0)  # Clears the file content

# Initialize session data with structure for computed values
kline_sessions_data = {
    'sydney': {'kline': deque(maxlen=200), 'mean': None, 'high_low': None, 'vwap': None, 'trendline': None},
    'tokyo': {'kline': deque(maxlen=200), 'mean': None, 'high_low': None, 'vwap': None, 'trendline': None},
    'london': {'kline': deque(maxlen=200), 'mean': None, 'high_low': None, 'vwap': None, 'trendline': None},
    'ny': {'kline': deque(maxlen=200), 'mean': None, 'high_low': None, 'vwap': None, 'trendline': None},
}

# Global Kline data with RSI and ATR values
kline_data = {
    'kline': deque(maxlen=200),
    'rsi': None,
    'atr': None,
    'highest_high':None,
    'lowest_low':None
}

last_active_sessions = set()  # Stores previously active sessions

# Position tracking dictionary
current_position_data = {
    'position': None,  # 'long' or 'short'
    'entry': None,     # Entry price
    'stoploss': None,  # Stop-loss price
    'stage': 0,        # 0 = entry, 1 = active, etc.
    'pnl': 0           # Profit and Loss

}

# Initialize counters for wins and losses
win_count = 0
loss_count = 0

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
    active_sessions = set(get_active_sessions(timestamp))  # Convert to set for comparison

    print(f"Timestamp: {timestamp} | PHT Time: {pht_time} | Open: {open_price} | High: {high} | Low: {low} | Close: {close} | Volume: {volume} | Quote Volume: {quote_volume} | Active Sessions: {active_sessions}\n")

    # Append kline data
    kline_data['kline'].append([timestamp, open_price, high, low, close, volume, quote_volume])

    # Compute RSI & ATR
    kline_data['rsi'] = get_rsi(list(kline_data['kline']),14)
    kline_data['atr'] = get_atr(list(kline_data['kline']))
    kline_data['highest_high'] = get_highest_high(list(kline_data['kline']),CANDLE_CLOSE)
    kline_data['lowest_low'] = get_lowest_low(list(kline_data['kline']),CANDLE_CLOSE)

    print(f"Global RSI: {kline_data['rsi']}")
    print(f"Global ATR: {kline_data['atr']}")
    print(f"Global HH: {kline_data['highest_high']}")
    print(f"Global LL: {kline_data['lowest_low']}")

    # Detect new sessions
    new_sessions = active_sessions - last_active_sessions  # Find sessions that were not active before

    # Reset Kline data for newly activated sessions
    for session in new_sessions:
        print(f"New session detected: {session}, resetting kline data...")
        kline_sessions_data[session]['kline'].clear()

    # Append kline data to active sessions and update computed values
    for session in active_sessions:
        kline_sessions_data[session]['kline'].append([timestamp, open_price, high, low, close, volume, quote_volume])

        # Compute and store new values
        kline_sessions_data[session]['mean'] = get_mean_close(list(kline_sessions_data[session]['kline']))
        kline_sessions_data[session]['high_low'] = get_highest_high_lowest_low(list(kline_sessions_data[session]['kline']))
        kline_sessions_data[session]['vwap'] = get_vwap(list(kline_sessions_data[session]['kline']))
        kline_sessions_data[session]['trendline'] = get_market_trendline_slope(list(kline_sessions_data[session]['kline']))

        # Print updated session values
        print(f"{session} Mean: {kline_sessions_data[session]['mean']}")
        print(f"{session} High Low: {kline_sessions_data[session]['high_low']}")
        print(f"{session} VWAP: {kline_sessions_data[session]['vwap']}")
        print(f"{session} Trendline: {kline_sessions_data[session]['trendline']}")

    # **Trading Logic:**
    if pht_time.hour == 8 and pht_time.minute == 0 and current_position_data['stage'] == 0:  # 10 AM PHT
        
        if OPEN_STRAT:
            sydney_trendline = kline_sessions_data['sydney']['trendline']
            sydney_high_low = kline_sessions_data['sydney']['high_low']
            
            tokyo_trendline = kline_sessions_data['tokyo']['trendline']
            tokyo_high_low = kline_sessions_data['tokyo']['high_low']

            # Ensure trendline and high_low values exist for Sydney and Tokyo
            if sydney_trendline is not None and sydney_high_low is not None and tokyo_trendline is not None and tokyo_high_low is not None:
                    
                highest_high, lowest_low = sydney_high_low  # Unpack the tuple into highest_high and lowest_low
                tokyo_high, tokyo_low = tokyo_high_low  # Unpack Tokyo high and low values (if needed for stop loss)
                
                # Check the trendlines for both Sydney and Tokyo
                if sydney_trendline > 0 and tokyo_trendline > 0 and current_position_data['position'] is None:
                    # Both Sydney and Tokyo are positive, enter a LONG position
                    current_position_data['position'] = 'long'
                    current_position_data['entry'] = close
                    current_position_data['stoploss'] = lowest_low  # Long Stoploss: Lowest Low
                    current_position_data['stage'] = 1  # Entry stage
                    print(f"Entered LONG position at {close}, Stoploss: {current_position_data['stoploss']}")

                elif sydney_trendline < 0 and tokyo_trendline < 0 and current_position_data['position'] is None:
                    # Both Sydney and Tokyo are negative, enter a SHORT position
                    current_position_data['position'] = 'short'
                    current_position_data['entry'] = close
                    current_position_data['stoploss'] = highest_high  # Short Stoploss: Highest High
                    current_position_data['stage'] = 1  # Entry stage
                    print(f"Entered SHORT position at {close}, Stoploss: {current_position_data['stoploss']}")

                else:
                    # If one trendline is positive and the other is negative, do not enter a trade
                    print("No trade entered. One of the trendlines is positive and the other is negative.")

        elif not OPEN_STRAT:
            sydney_trendline = kline_sessions_data['sydney']['trendline']
            sydney_high_low = kline_sessions_data['sydney']['high_low']
            
            if sydney_trendline is not None and sydney_high_low is not None:  # Ensure values exist
                highest_high, lowest_low = sydney_high_low  # Unpack the tuple into highest_high and lowest_low

                if sydney_trendline > 0 and current_position_data['position'] is None:  # Long position condition
                    current_position_data['position'] = 'long'
                    current_position_data['entry'] = close
                    current_position_data['stoploss'] = lowest_low  # Long Stoploss: Lowest Low - ATR
                    current_position_data['stage'] = 1  # Entry stage
                    print(f"Entered LONG position at {close}, Stoploss: {current_position_data['stoploss']}")

                elif sydney_trendline < 0 and current_position_data['position'] is None:  # Short position condition
                    current_position_data['position'] = 'short'
                    current_position_data['entry'] = close
                    current_position_data['stoploss'] = highest_high # Short Stoploss: Highest High + ATR
                    current_position_data['stage'] = 1  # Entry stage

                    print(f"Entered SHORT position at {close}, Stoploss: {current_position_data['stoploss']}")

    elif pht_time.hour == 14 and pht_time.minute == 0 and current_position_data['stage'] == 1:

        sydney_mean = kline_sessions_data['sydney']['mean']

        if current_position_data['position'] == 'long':

            if sydney_mean > current_position_data['stoploss']:

                current_position_data['stage'] = 2 
                current_position_data['stoploss'] = sydney_mean

        elif current_position_data['position'] == 'short':

            if sydney_mean < current_position_data['stoploss']:

                current_position_data['stage'] = 2 
                current_position_data['stoploss'] = sydney_mean

    elif pht_time.hour == 17 and pht_time.minute == 0 and current_position_data['stage'] == 2:

        tokyo_mean = kline_sessions_data['tokyo']['mean']


        if current_position_data['position'] == 'long':

            if tokyo_mean > current_position_data['stoploss']:

                current_position_data['stage'] = 3 
                current_position_data['stoploss'] = tokyo_mean

        elif current_position_data['position'] == 'short':

            if tokyo_mean < current_position_data['stoploss']:

                current_position_data['stage'] = 3 
                current_position_data['stoploss'] = tokyo_mean

    elif pht_time.hour == 0 and pht_time.minute == 0 and current_position_data['stage'] == 3:

        london_mean = kline_sessions_data['london']['mean']

        if current_position_data['position'] == 'long':

            if london_mean > current_position_data['stoploss']:

                current_position_data['stage'] = 4
                current_position_data['stoploss'] = london_mean

        elif current_position_data['position'] == 'short':

            if london_mean < current_position_data['stoploss']:

                current_position_data['stage'] = 4
                current_position_data['stoploss'] = london_mean

    elif pht_time.hour == 0 and pht_time.minute == 0 and current_position_data['stage'] == 4:

        ny_mean = kline_sessions_data['ny']['mean']

        if current_position_data['position'] == 'long':

            if ny_mean > current_position_data['stoploss']:

                current_position_data['stage'] = 5
                current_position_data['stoploss'] = ny_mean

        elif current_position_data['position'] == 'short':

            if ny_mean < current_position_data['stoploss']:

                current_position_data['stage'] = 5
                current_position_data['stoploss'] = ny_mean

    elif pht_time.hour == 5 and pht_time.minute == 0 and current_position_data['stage'] == 5:
        # Exit end of session 
        if current_position_data['position'] == 'long':
            # Stop-loss hit for Long position, calculate PnL
            pnl_percentage = ((close - current_position_data['entry']) / current_position_data['entry']) * 100
            pnl_percentage_after_fee = pnl_percentage - (2 * trading_fee)  # Deduct fees for both entry and exit
            
            if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
                current_position_data['pnl'] += pnl_percentage_after_fee
                win_count += 1  # Increment win count for a profitable trade
                print(f"Stop-loss hit for LONG position. Profitable PnL: {pnl_percentage_after_fee}%")
            else:
                # Deduct the loss from the running PnL for LONG position
                loss_value = abs(pnl_percentage_after_fee)
                current_position_data['pnl'] -= loss_value
                loss_count += 1  # Increment loss count
                print(f"Stop-loss hit for LONG position. Loss: {loss_value}%")

            # Save PnL to CSV
            with open(pnl_file, 'a', newline='') as file:
                writer = csv.writer(file)
                writer.writerow([pht_time, current_position_data['pnl']])  # Add the PnL value for this trade

            current_position_data = {
                'position': None,
                'entry': None,
                'stoploss': None,
                'stage': 0,
                'pnl': current_position_data['pnl']  # Keep the running PnL
            }

        elif current_position_data['position'] == 'short':
            # Stop-loss hit for Short position, calculate PnL
            pnl_percentage = ((current_position_data['entry'] - close) / current_position_data['entry']) * 100
            pnl_percentage_after_fee = pnl_percentage - (2 * trading_fee)  # Deduct fees for both entry and exit
            
            if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
                current_position_data['pnl'] += pnl_percentage_after_fee
                win_count += 1  # Increment win count for a profitable trade
                print(f"Stop-loss hit for SHORT position. Profitable PnL: {pnl_percentage_after_fee}%")
            else:
                # Deduct the loss from the running PnL for SHORT position
                loss_value = abs(pnl_percentage_after_fee)
                current_position_data['pnl'] -= loss_value
                loss_count += 1  # Increment loss count
                print(f"Stop-loss hit for SHORT position. Loss: {loss_value}%")

            # Save PnL to CSV
            with open(pnl_file, 'a', newline='') as file:
                writer = csv.writer(file)
                writer.writerow([pht_time, current_position_data['pnl']])  # Add the PnL value for this trade

            current_position_data = {
                'position': None,
                'entry': None,
                'stoploss': None,
                'stage': 0,
                'pnl': current_position_data['pnl']  # Keep the running PnL
            }
        

    # **Stop Loss Logic:**
    if current_position_data['position'] == 'long' and close <= current_position_data['stoploss']:
        # Stop-loss hit for Long position, calculate PnL
        pnl_percentage = ((close - current_position_data['entry']) / current_position_data['entry']) * 100
        pnl_percentage_after_fee = pnl_percentage - (2 * trading_fee)  # Deduct fees for both entry and exit
        
        if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
            current_position_data['pnl'] += pnl_percentage_after_fee
            win_count += 1
            print(f"Stop-loss hit for LONG position. Profitable PnL: {pnl_percentage_after_fee}%")
        else:
            # Deduct the loss from the running PnL for LONG position
            loss_value = abs(pnl_percentage_after_fee)  # Get the absolute value of the loss
            current_position_data['pnl'] -= loss_value
            loss_count += 1
            print(f"Stop-loss hit for LONG position. Loss PnL: {pnl_percentage_after_fee}%")


        # Save PnL to CSV
        with open(pnl_file, 'a', newline='') as file:
            writer = csv.writer(file)
            writer.writerow([pht_time, current_position_data['pnl']])  # Add the PnL value for this trade
        # Reset position data
        current_position_data = {
            'position': None,
            'entry': None,
            'stoploss': None,
            'stage': 0,
            'pnl': current_position_data['pnl']  # Keep the running PnL
        }

    elif current_position_data['position'] == 'short' and close >= current_position_data['stoploss']:
        # Stop-loss hit for Short position, calculate PnL
        pnl_percentage = ((current_position_data['entry'] - close) / current_position_data['entry']) * 100
        pnl_percentage_after_fee = pnl_percentage - (2 * trading_fee)  # Deduct fees for both entry and exit
        
        if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
            current_position_data['pnl'] += pnl_percentage_after_fee
            win_count += 1
            print(f"Stop-loss hit for SHORT position. Profitable PnL: {pnl_percentage_after_fee}%")
        else:
            # Deduct the loss from the running PnL for SHORT position
            loss_value = abs(pnl_percentage_after_fee)  # Get the absolute value of the loss
            current_position_data['pnl'] -= loss_value
            loss_count += 1
            print(f"Stop-loss hit for SHORT position. Loss PnL: {pnl_percentage_after_fee}%")
            # Save PnL to CSV

        with open(pnl_file, 'a', newline='') as file:
            writer = csv.writer(file)
            writer.writerow([pht_time, current_position_data['pnl']])  # Add the PnL value for this trade
        # Reset position data
        current_position_data = {
            'position': None,
            'entry': None,
            'stoploss': None,
            'stage': 0,
            'pnl': current_position_data['pnl']  # Keep the running PnL
        }

    # **Take Profit Logic:**

    if not CC_STRAT:
        if pht_time.hour >= 15 or pht_time.hour < 5:  # Time between 15:00 and 5:00

            if current_position_data['position'] == 'long' and kline_data['rsi'] > 70:
                # RSI > 70, take profit for long position
                pnl_percentage = ((close - current_position_data['entry']) / current_position_data['entry']) * 100
                pnl_percentage_after_fee = pnl_percentage - (2 * trading_fee)  # Deduct fees for both entry and exit
                
                if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
                    current_position_data['pnl'] += pnl_percentage_after_fee
                    win_count += 1
                    print(f"Take profit for LONG position. Profitable PnL: {pnl_percentage_after_fee}%")
                else:
                    # Subtract loss from running PnL for LONG position
                    loss_value = abs(pnl_percentage_after_fee)  # Get the absolute value of the loss
                    current_position_data['pnl'] -= loss_value
                    loss_count += 1
                    print(f"Take profit for LONG position. Loss PnL: {pnl_percentage_after_fee}%")
                
                            # Save PnL to CSV
                with open(pnl_file, 'a', newline='') as file:
                    writer = csv.writer(file)
                    writer.writerow([pht_time, current_position_data['pnl']])  # Add the PnL value for this trade
                # Reset position data
                current_position_data = {
                    'position': None,
                    'entry': None,
                    'stoploss': None,
                    'stage': 0,
                    'pnl': current_position_data['pnl']  # Keep the running PnL
                }

            elif current_position_data['position'] == 'short' and kline_data['rsi'] < 30:
                # RSI < 30, take profit for short position
                pnl_percentage = ((current_position_data['entry'] - close) / current_position_data['entry']) * 100
                pnl_percentage_after_fee = pnl_percentage - (2 * trading_fee)  # Deduct fees for both entry and exit
                
                if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
                    current_position_data['pnl'] += pnl_percentage_after_fee
                    win_count += 1
                    print(f"Take profit for SHORT position. Profitable PnL: {pnl_percentage_after_fee}%")
                else:
                    # Subtract loss from running PnL for SHORT position
                    loss_value = abs(pnl_percentage_after_fee)  # Get the absolute value of the loss
                    current_position_data['pnl'] -= loss_value
                    loss_count += 1
                    print(f"Take profit for SHORT position. Loss PnL: {pnl_percentage_after_fee}%")
                
                # Reset position data

                                # Save PnL to CSV
                with open(pnl_file, 'a', newline='') as file:
                    writer = csv.writer(file)
                    writer.writerow([pht_time, current_position_data['pnl']])  # Add the PnL value for this trade

                current_position_data = {
                    'position': None,
                    'entry': None,
                    'stoploss': None,
                    'stage': 0,
                    'pnl': current_position_data['pnl']  # Keep the running PnL
                }

    elif CC_STRAT:

        if pht_time.hour >= 15 or pht_time.hour < 5:  # Time between 15:00 and 5:00

            if current_position_data['position'] == 'long' and kline_data['rsi'] > 70:
                current_position_data['stoploss'] = kline_data['lowest_low'] 

            elif current_position_data['position'] == 'short' and kline_data['rsi'] < 30:
                current_position_data['stoploss'] = kline_data['highest_high'] 



    print(current_position_data['pnl'])
    print(win_count,loss_count)
    # Update last active sessions for the next iteration

    
    # save current status data to csv per loop including pnl and win/loss count and position data
    with open(save_file, 'a', newline='') as file:
        writer = csv.writer(file)
        writer.writerow([pht_time, current_position_data['pnl'], win_count, loss_count, current_position_data['position'], current_position_data['entry'], current_position_data['stoploss'], current_position_data['stage']])  # Add the PnL value for this
    
    last_active_sessions = active_sessions.copy()
