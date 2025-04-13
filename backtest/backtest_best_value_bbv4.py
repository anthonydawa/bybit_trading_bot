from collections import deque
import time
import csv
from collections import deque
import time
from backtestv1_functions import get_active_sessions, get_bollinger_bands, get_bollinger_bands_width, load_data_from_file, convert_to_pht, get_rsi, get_atr
import pandas as pd


market = "MOBILEUSDT"     
data = load_data_from_file(f'backtest/historical_klines/{market}_5m_historical_data.json')         
pnl_file = 'pnl_progression_bbw.csv'  # File to save PnL progression
# Define trading fee percentage (0.11% total for both entry and exit)
final_data_save = f'backtest/best_values_bb/final_status_{market}.csv'

#clear the final_data_save and add a header

# Ensure the file exists and read existing results
try:
    existing_results = set()
    with open(final_data_save, 'r') as file:
        reader = csv.reader(file)
        next(reader)  # Skip header
        for row in reader:
            existing_results.add(tuple(row[:6]))  # Use only parameter values to check uniqueness
except FileNotFoundError:
    existing_results = set()
    with open(final_data_save, 'w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(["market", "BBW_THRESHOLD", "BB_PERIOD", "BB_STD_DEV", "ATR_MULTIPLIER_TP", "ATR_MULTIPLIER_SL", "trading_fee", "win_count", "loss_count", "pnl"])


with open(final_data_save, 'w', newline='') as file:
    writer = csv.writer(file)
    writer.writerow(["market", "BBW_THRESHOLD", "BB_PERIOD", "BB_STD_DEV", "ATR_MULTIPLIER_TP", "ATR_MULTIPLIER_SL", "trading_fee", "win_count", "loss_count", "pnl"])  # Add the PnL value for this trade


# define list of values to test for all variables
BBW_THRESHOLD_LIST = [0.05, 0.04, 0.06, 0.07, 0.08, 0.09 , 0.1]
BB_PERIOD_LIST = [18, 19, 20, 21]
BB_STD_DEV_LIST = [1.7, 1.8, 1.9, 2, 2.1, 2.2,]
ATR_MULTIPLIER_LIST_PAIR = [(1,1),(2, 1), (2, 2),(2, 1.5), (3, 1), (3, 2), (3, 3),(3,1.5),(4,1),(4,2),(4,3),(4,4)]
trading_fee = 0.055 / 100  # 0.055%
slippage = 0.5 / 100  # 0.3% assumed slippage for altcoins
total_fee = (trading_fee * 2) + slippage


#loop all of the Variables
# Loop through parameters
for BBW_THRESHOLD in BBW_THRESHOLD_LIST:
    for BB_PERIOD in BB_PERIOD_LIST:
        for BB_STD_DEV in BB_STD_DEV_LIST:
            for ATR_MULTIPLIER_TP, ATR_MULTIPLIER_SL in ATR_MULTIPLIER_LIST_PAIR:
                param_tuple = (market, str(BBW_THRESHOLD), str(BB_PERIOD), str(BB_STD_DEV), str(ATR_MULTIPLIER_TP), str(ATR_MULTIPLIER_SL))

                if param_tuple in existing_results:
                    print(f"Skipping already completed iteration: {param_tuple}")
                    continue

                print(f"Running backtest for {param_tuple}")

                # Global Kline data with RSI and ATR values
                kline_data = {
                    'kline': deque(maxlen=200),
                    'rsi': None,
                    'atr': None,
                    'bollinger_bands': None,
                    'bbw': None
                }

                # Position tracking dictionary
                current_position_data = {
                    'position': None,  # 'long' or 'short'
                    'entry': None,     # Entry price
                    'takeprofit': None,  # Take-profit price
                    'stoploss': None,  # Stop-loss price
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

                    pht_time = convert_to_pht(timestamp)
                    active_sessions = set(get_active_sessions(timestamp))  # Convert to set for comparison

                    # Append kline data
                    kline_data['kline'].append([timestamp, open_price, high, low, close, volume, quote_volume])

                    # Compute RSI & ATR
                    kline_data['rsi'] = get_rsi(list(kline_data['kline']),14)
                    kline_data['atr'] = get_atr(list(kline_data['kline']))

                    kline_data['bollinger_bands'] = get_bollinger_bands(list(kline_data['kline']), BB_PERIOD, BB_STD_DEV)
                    kline_data['bbw'] = get_bollinger_bands_width(list(kline_data['kline']))
                    
                    if isinstance(kline_data['bbw'], dict) and 'error' in kline_data['bbw']:
                        continue

                    if kline_data['bbw'] is None:
                        kline_data['bbw'] = None

                    if kline_data['bollinger_bands'] is None:
                        kline_data['bollinger_bands'] = (None, None)

                    upper_band, lower_band = kline_data['bollinger_bands'] 

    
                    # **Take Profit Logic:**
                    if current_position_data['position'] == 'long' and close >= current_position_data['takeprofit']:
                        pnl_percentage = ((close - current_position_data['entry']) / current_position_data['entry']) * 100
                        pnl_percentage_after_fee = pnl_percentage - total_fee  # Deduct fees for both entry and exit
                        
                        if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
                            current_position_data['pnl'] += pnl_percentage_after_fee
                            win_count += 1
                        else:
                            # Subtract loss from running PnL for LONG position
                            loss_value = abs(pnl_percentage_after_fee)  # Get the absolute value of the loss
                            current_position_data['pnl'] -= loss_value
                            loss_count += 1
                        
                                    # Save PnL to CSV
                        with open(pnl_file, 'a', newline='') as file:
                            writer = csv.writer(file)
                            writer.writerow([pht_time, current_position_data['pnl']])  # Add the PnL value for this trade
                        # Reset position data
                        current_position_data = {
                            'position': None,
                            'entry': None,
                            'stoploss': None,
                            'takeprofit': None,
                            'pnl': current_position_data['pnl']  # Keep the running PnL
                        }
                        
                    elif current_position_data['position'] == 'short' and close <= current_position_data['takeprofit']:
                    
                        pnl_percentage = ((current_position_data['entry'] - close) / current_position_data['entry']) * 100
                        pnl_percentage_after_fee = pnl_percentage - total_fee  # Deduct fees for both entry and exit
                        
                        if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
                            current_position_data['pnl'] += pnl_percentage_after_fee
                            win_count += 1
                        else:
                            # Subtract loss from running PnL for SHORT position
                            loss_value = abs(pnl_percentage_after_fee)  # Get the absolute value of the loss
                            current_position_data['pnl'] -= loss_value
                            loss_count += 1
                        
                        # Reset position data

                                        # Save PnL to CSV
                        with open(pnl_file, 'a', newline='') as file:
                            writer = csv.writer(file)
                            writer.writerow([pht_time, current_position_data['pnl']])  # Add the PnL value for this trade

                        current_position_data = {
                            'position': None,
                            'entry': None,
                            'stoploss': None,
                            'takeprofit': None,
                            'pnl': current_position_data['pnl']  # Keep the running PnL
                        }
                        
                    # **Stop Loss Logic:**
                    if current_position_data['position'] == 'long' and close <= current_position_data['stoploss']:
                        # Stop-loss hit for Long position, calculate PnL
                        pnl_percentage = ((close - current_position_data['entry']) / current_position_data['entry']) * 100
                        pnl_percentage_after_fee = pnl_percentage - total_fee  # Deduct fees for both entry and exit
                        
                        if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
                            current_position_data['pnl'] += pnl_percentage_after_fee
                            win_count += 1
                        else:
                            # Deduct the loss from the running PnL for LONG position
                            loss_value = abs(pnl_percentage_after_fee)  # Get the absolute value of the loss
                            current_position_data['pnl'] -= loss_value
                            loss_count += 1


                        # Save PnL to CSV
                        with open(pnl_file, 'a', newline='') as file:
                            writer = csv.writer(file)
                            writer.writerow([pht_time, current_position_data['pnl']])  # Add the PnL value for this trade
                        # Reset position data
                        current_position_data = {
                            'position': None,
                            'entry': None,
                            'stoploss': None,
                            'takeprofit': None,
                            'pnl': current_position_data['pnl']  # Keep the running PnL
                        }
                        
                    elif current_position_data['position'] == 'short' and close >= current_position_data['stoploss']:
                        # Stop-loss hit for Short position, calculate PnL
                        pnl_percentage = ((current_position_data['entry'] - close) / current_position_data['entry']) * 100
                        pnl_percentage_after_fee = pnl_percentage - total_fee  # Deduct fees for both entry and exit
                        
                        if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
                            current_position_data['pnl'] += pnl_percentage_after_fee
                            win_count += 1
                        else:
                            # Deduct the loss from the running PnL for SHORT position
                            loss_value = abs(pnl_percentage_after_fee)  # Get the absolute value of the loss
                            current_position_data['pnl'] -= loss_value
                            loss_count += 1
                            # Save PnL to CSV

                        with open(pnl_file, 'a', newline='') as file:
                            writer = csv.writer(file)
                            writer.writerow([pht_time, current_position_data['pnl']])  # Add the PnL value for this trade
                        # Reset position data
                        current_position_data = {
                            'position': None,
                            'entry': None,
                            'stoploss': None,
                            'takeprofit': None,
                            'pnl': current_position_data['pnl']  # Keep the running PnL
                        }
                        
                    # **Entry Logic:**
                    if current_position_data['position'] is None and upper_band is not None and lower_band is not None and kline_data['bbw'] is not None:
                        # if high is above the upper band and the bbw is greater than the threshold, go short
                        if upper_band <= high and kline_data['bbw'] >= BBW_THRESHOLD:
                            current_position_data['position'] = 'short'
                            current_position_data['entry'] = close
                            current_position_data['stoploss'] = close + (kline_data['atr'] * ATR_MULTIPLIER_SL)
                            current_position_data['takeprofit'] = close - (kline_data['atr'] * ATR_MULTIPLIER_TP)

                        elif lower_band >= low and kline_data['bbw'] >= BBW_THRESHOLD:
                            current_position_data['position'] = 'long'
                            current_position_data['entry'] = close
                            current_position_data['stoploss'] = close - (kline_data['atr'] * ATR_MULTIPLIER_SL)
                            current_position_data['takeprofit'] = close + (kline_data['atr'] * ATR_MULTIPLIER_TP)
                    
            

   
                # save final value on a csv with variables used for the backtest
                
                with open(final_data_save, 'a', newline='') as file:
                    writer = csv.writer(file)
                    writer.writerow([market, BBW_THRESHOLD, BB_PERIOD, BB_STD_DEV, ATR_MULTIPLIER_TP, ATR_MULTIPLIER_SL, total_fee, win_count, loss_count , current_position_data['pnl']])  # Add the PnL value for this trade 
                
                #sort by pnl
                df = pd.read_csv(final_data_save)
                df = df.sort_values(by=['pnl'], ascending=False)
                df.to_csv(final_data_save, index=False)
                

