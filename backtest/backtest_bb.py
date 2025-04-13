from collections import deque
import time

from backtestv1_functions import get_active_sessions, get_bollinger_bands, get_bollinger_bands_width, get_highest_high_lowest_low, get_market_trendline_slope, get_mean_close, get_vwap, load_data_from_file, convert_to_pht, get_rsi, get_atr

data = load_data_from_file('backtest/historical_klines/SOLUSDT_5m_historical_data.json')

# Define trading fee percentage (0.11% total for both entry and exit)
trading_fee = 0.11 / 100  # 0.11%

BBW_THRESHOLD = 0.05  # Threshold for Bollinger Bands Width
BB_PERIOD = 20  # Period for Bollinger Bands calculation
BB_STD_DEV = 2  # Standard Deviation for Bollinger Bands calculation
ATR_MULTIPLIER_TP = 4  # Multiplier for Take Profit based on ATR
ATR_MULTIPLIER_SL = 2  # Multiplier for Stop Loss based on ATR


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
    'atr': None
}

last_active_sessions = set()  # Stores previously active sessions

# Position tracking dictionary
current_position_data = {
    'position': None,  # 'long' or 'short'
    'entry': None,     # Entry price
    'stoploss': None,  # Stop-loss price
    'takeprofit': None,  # Take-profit price
    'stage': 0,        # 0 = entry, 1 = active, etc.
    'pnl': 0           # Profit and Loss
}

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
    kline_data['rsi'] = get_rsi(list(kline_data['kline']))
    kline_data['atr'] = get_atr(list(kline_data['kline']))
    kline_data['bollinger_bands'] = get_bollinger_bands(list(kline_data['kline']), BB_STD_DEV, BB_PERIOD)
    kline_data['bbw'] = get_bollinger_bands_width(list(kline_data['kline']))
    if kline_data['bollinger_bands'] is None:
        kline_data['bollinger_bands'] = (None, None)

    upper_band, lower_band = kline_data['bollinger_bands'] 

    print(f"Global RSI: {kline_data['rsi']}")
    print(f"Global ATR: {kline_data['atr']}")

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



    # **Stop Loss Logic:**
    if current_position_data['position'] == 'long' and close <= current_position_data['stoploss']:
        # Stop-loss hit for Long position, calculate PnL
        pnl_percentage = ((close - current_position_data['entry']) / current_position_data['entry']) * 100
        pnl_percentage_after_fee = pnl_percentage - (2 * trading_fee)  # Deduct fees for both entry and exit
        if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
            current_position_data['pnl'] += pnl_percentage_after_fee
            print(f"Stop-loss hit for LONG position. Profitable PnL: {pnl_percentage_after_fee}%")
        else:
            print(f"Stop-loss hit for LONG position. No profit (Pnl: {pnl_percentage_after_fee}%)")

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
        pnl_percentage_after_fee = pnl_percentage - (2 * trading_fee)  # Deduct fees for both entry and exit
        if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
            current_position_data['pnl'] += pnl_percentage_after_fee
            print(f"Stop-loss hit for SHORT position. Profitable PnL: {pnl_percentage_after_fee}%")
        else:
            print(f"Stop-loss hit for SHORT position. No profit (Pnl: {pnl_percentage_after_fee}%)")

        # Reset position data
        current_position_data = {
            'position': None,
            'entry': None,
            'stoploss': None,
            'takeprofit': None,
            'stage': 0,
            'pnl': current_position_data['pnl']  # Keep the running PnL
        }

    # **Take Profit Logic:**
    
    if current_position_data['position'] == 'long' and close >= current_position_data['takeprofit']:
        # RSI > 70, take profit for long position
        pnl_percentage = ((close - current_position_data['entry']) / current_position_data['entry']) * 100
        pnl_percentage_after_fee = pnl_percentage - (2 * trading_fee)  # Deduct fees for both entry and exit
        if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
            current_position_data['pnl'] += pnl_percentage_after_fee
            print(f"Take profit for LONG position. Profitable PnL: {pnl_percentage_after_fee}%")
        else:
            current_position_data['pnl'] += pnl_percentage_after_fee  # Subtract loss from PnL
            print(f"Take profit for LONG position. Loss (Pnl: {pnl_percentage_after_fee}%)")
        
        # Reset position data
        current_position_data = {
            'position': None,
            'entry': None,
            'stoploss': None,
            'stage': 0,
            'pnl': current_position_data['pnl']  # Keep the running PnL
        }

    elif current_position_data['position'] == 'short' and close <= current_position_data['takeprofit']:
        # RSI < 30, take profit for short position
        pnl_percentage = ((current_position_data['entry'] - close) / current_position_data['entry']) * 100
        pnl_percentage_after_fee = pnl_percentage - (2 * trading_fee)  # Deduct fees for both entry and exit
        if pnl_percentage_after_fee > 0:  # Ensure it's still profitable after fees
            current_position_data['pnl'] += pnl_percentage_after_fee
            print(f"Take profit for SHORT position. Profitable PnL: {pnl_percentage_after_fee}%")
        else:
            current_position_data['pnl'] += pnl_percentage_after_fee  # Subtract loss from PnL
            print(f"Take profit for SHORT position. Loss (Pnl: {pnl_percentage_after_fee}%)")
        
        # Reset position data
        current_position_data = {
            'position': None,
            'entry': None,
            'stoploss': None,
            'stage': 0,
            'pnl': current_position_data['pnl']  # Keep the running PnL
        }

    # **Trading Logic:**
    if current_position_data['position'] is None:
        # if close is above the upper band and the bbw is greater than the threshold, go short
        if upper_band is not None and upper_band < close and kline_data['bbw'] > BBW_THRESHOLD:
            current_position_data['position'] = 'short'
            current_position_data['entry'] = close
            current_position_data['stoploss'] = close + (kline_data['atr'] * ATR_MULTIPLIER_SL)
            current_position_data['takeprofit'] = close - (kline_data['atr'] * ATR_MULTIPLIER_TP)

        elif lower_band is not None and lower_band > close and kline_data['bbw'] > BBW_THRESHOLD:
            current_position_data['position'] = 'long'
            current_position_data['entry'] = close
            current_position_data['stoploss'] = close - (kline_data['atr'] * ATR_MULTIPLIER_SL)
            current_position_data['takeprofit'] = close + (kline_data['atr'] * ATR_MULTIPLIER_TP)

    print(current_position_data['pnl'])

    # Update last active sessions for the next iteration
    last_active_sessions = active_sessions.copy()
