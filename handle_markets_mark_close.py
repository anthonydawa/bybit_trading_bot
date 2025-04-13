import pandas as pd

def update_mark_close(csv="markets.csv",sessions=['sydney', 'tokyo']):
    try:
        # Load the CSV files
        markets_df = pd.read_csv('markets.csv')
        rsi_df = pd.read_csv('rsi_evaluation_results.csv')

        # Loop through each row in the markets DataFrame
        for index, market_row in markets_df.iterrows():
            symbol = market_row['symbol']
            position = market_row['position']

            # Initialize mark_close as False
            mark_close = False

            # Loop through each session and check the RSI data
            for session in sessions:
                # Filter the RSI evaluation results for the symbol and current session
                rsi_data = rsi_df[rsi_df['Market'].str.contains(symbol) & (rsi_df['Session'] == session)]

                if rsi_data.empty:
                    print(f"Error: No RSI data found for symbol {symbol} in session {session}.")
                    continue  # Skip this session if no RSI data is found

                # Get the RSI level from the filtered data
                rsi_level = rsi_data['RSI Level'].values[0].lower()

                # Check the position and the RSI level to determine if mark_close should be True
                if position == 'long' and (rsi_level == 'overbought' or rsi_level == 'both'):
                    mark_close = True
                    break  # No need to check other sessions if we found the desired RSI level

                elif position == 'short' and (rsi_level == 'oversold' or rsi_level == 'both'):
                    mark_close = True
                    break  # No need to check other sessions if we found the desired RSI level

            # Update the mark_close column in the markets dataframe
            markets_df.loc[markets_df['symbol'] == symbol, 'mark_close'] = mark_close

            # Print success or error message for each symbol
            if mark_close:
                print(f"Success: mark_close for {symbol} updated to True.")
            else:
                print(f"Success: mark_close for {symbol} updated to False.")

        # Save the updated markets dataframe to the CSV
        markets_df.to_csv(csv, index=False)

    except Exception as e:
        print(f"Error: An exception occurred - {e}")

if __name__ == "__main__":
    update_mark_close()