import pandas as pd
import json
import numpy as np

from market_filter_rsi import check_rsi_levels

# Load session information from sessions.json
with open('sessions.json', 'r') as file:
    sessions_info = json.load(file)

def update_mark_close(sessions=['sydney', 'tokyo'], interval='5', category='linear', period=14):
    try:
        # Load the markets data
        markets_df = pd.read_csv('markets.csv')

        # Loop through each row in the markets DataFrame
        for index, market_row in markets_df.iterrows():
            symbol = market_row['symbol']
            position = market_row['position']

            # Initialize mark_close as False
            mark_close = False

            # Loop through each session and check RSI levels
            for session in sessions:
                session_start = sessions_info[session]['start_epoch']
                session_end = sessions_info[session]['end_epoch']

                # Get RSI levels for the session
                rsi_level = check_rsi_levels(
                    symbol=symbol,
                    interval=interval,
                    start=session_start,
                    end=session_end,
                    category=category,
                    period=period
                )

                # Determine mark_close based on position and RSI level
                if position == 'long' and rsi_level in ['overbought', 'both']:
                    mark_close = True
                    break
                elif position == 'short' and rsi_level in ['oversold', 'both']:
                    mark_close = True
                    break

            # Update the mark_close column in the markets dataframe
            markets_df.loc[markets_df['symbol'] == symbol, 'mark_close'] = mark_close

            # Print status messages
            if mark_close:
                print(f"Success: mark_close for {symbol} updated to True.")
            else:
                print(f"Success: mark_close for {symbol} updated to False.")

        # Save the updated markets dataframe to the CSV
        markets_df.to_csv('markets.csv', index=False)

    except Exception as e:
        print(f"Error: An exception occurred - {e}")

if __name__ == "__main__":
    update_mark_close()
