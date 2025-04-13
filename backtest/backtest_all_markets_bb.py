from collections import deque
import time
import csv
from collections import deque
import time
from backtestv1_functions import extract_trading_pair, get_active_sessions, get_bollinger_bands, get_bollinger_bands_width, get_file_paths, get_highest_high, get_highest_high_lowest_low, get_lowest_low, get_market_trendline_slope, get_mean_close, get_vwap, load_data_from_file, convert_to_pht, get_rsi, get_atr


folder_path = 'backtest/historical_klines'
file_paths = get_file_paths(folder_path)


for file_path in file_paths:
    try:
        
        trading_pair = extract_trading_pair(file_path)
        print('backtesting:', trading_pair)
        file_path = f'backtest/historical_klines/{trading_pair}_5m_historical_data.json'
        data = load_data_from_file(file_path)
        pnl_file = f'backtest/pnl_bb/{trading_pair}_pnl.csv'
        trading_fee = 0.055 / 100  # 0.055%
        slippage = 0.5 / 100  # 0.3% assumed slippage for altcoins
        total_fee = (trading_fee * 2) + slippage  # Double the fee, single slippage

        with open(pnl_file, 'w') as file:
            file.truncate(0)  # Clears the file content

        BBW_THRESHOLD = 0.05  # Threshold for Bollinger Bands Width
        BB_PERIOD = 20  # Period for Bollinger Bands calculation
        BB_STD_DEV = 2  # Standard Deviation for Bollinger Bands calculation
        ATR_MULTIPLIER_TP = 3  # Multiplier for Take Profit based on ATR
        ATR_MULTIPLIER_SL = 1.5  # Multiplier for Stop Loss based on ATR
        save_file = f'backtest/bb_market_status/current_status_{trading_pair}.csv'

        # Clear the save file
        with open(save_file, 'w') as file:
            file.truncate(0)  # Clears the file content
        # headers for the save file
        with open(save_file, 'a', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(['Timestamp', 'PnL', 'Win Count', 'Loss Count', 'Position', 'Entry', 'Stoploss', 'Takeprofit'])  # Add the PnL value for this trade
        with open(pnl_file, 'w') as file:
            file.truncate(0)  # Clears the file content

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
                # Take-profit hit for Long position, calculate PnL
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
                    'stage': 0,
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
                    'stage': 0,
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
                    'stage': 0,
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
                    'stage': 0,
                    'pnl': current_position_data['pnl']  # Keep the running PnL
                }
                
            # **Entry Logic:**
            if current_position_data['position'] is None and upper_band is not None and lower_band is not None and kline_data['bbw'] is not None:
                # if high is above the upper band and the bbw is greater than the threshold, go short
                if upper_band < high and kline_data['bbw'] > BBW_THRESHOLD:
                    current_position_data['position'] = 'short'
                    current_position_data['entry'] = close
                    current_position_data['stoploss'] = close + (kline_data['atr'] * ATR_MULTIPLIER_SL)
                    current_position_data['takeprofit'] = close - (kline_data['atr'] * ATR_MULTIPLIER_TP)

                elif lower_band > low and kline_data['bbw'] > BBW_THRESHOLD:
                    current_position_data['position'] = 'long'
                    current_position_data['entry'] = close
                    current_position_data['stoploss'] = close - (kline_data['atr'] * ATR_MULTIPLIER_SL)
                    current_position_data['takeprofit'] = close + (kline_data['atr'] * ATR_MULTIPLIER_TP)
            
            # save current status data to csv per loop including pnl and win/loss count and position data
            with open(save_file, 'a', newline='') as file:
                writer = csv.writer(file)
                writer.writerow([pht_time, current_position_data['pnl'], win_count, loss_count, current_position_data['position'], current_position_data['entry'], current_position_data['stoploss'], current_position_data['takeprofit']])  # Add the PnL value for this
            
    except:
        print(f"Error processing file: {file_path}")
        pass

