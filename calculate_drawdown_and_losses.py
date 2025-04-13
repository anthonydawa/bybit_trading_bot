import csv
import os
import pandas as pd

from backtest.backtestv1_functions import extract_trading_pair, get_file_paths

def calculate_win_loss_stats(file_path):
    # Load the CSV data
    data = pd.read_csv(file_path, header=None, names=['timestamp', 'pnl'])
    
    # Initialize variables
    biggest_win = 0
    biggest_loss = 0
    total_wins = 0
    total_losses = 0
    win_count = 0
    loss_count = 0
    longest_win_streak = 0
    longest_loss_streak = 0
    current_win_streak = 0
    current_loss_streak = 0
    
    # Iterate through the PnL data to calculate gains and losses
    for i in range(1, len(data)):
        current_pnl = data['pnl'].iloc[i]
        previous_pnl = data['pnl'].iloc[i - 1]
        
        # Calculate the change from the previous value
        change = current_pnl - previous_pnl
        
        # If the change is a win
        if change > 0:
            total_wins += change
            win_count += 1
            current_win_streak += 1
            current_loss_streak = 0  # Reset loss streak
            
            if change > biggest_win:
                biggest_win = change
            if current_win_streak > longest_win_streak:
                longest_win_streak = current_win_streak
                
        # If the change is a loss
        elif change < 0:
            total_losses += change
            loss_count += 1
            current_loss_streak += 1
            current_win_streak = 0  # Reset win streak
            
            if change < biggest_loss:
                biggest_loss = change
            if current_loss_streak > longest_loss_streak:
                longest_loss_streak = current_loss_streak
    
    # Calculate averages
    avg_win = total_wins / win_count if win_count > 0 else 0
    avg_loss = total_losses / loss_count if loss_count > 0 else 0
    
    # Calculate the Risk-Reward Ratio
    risk_reward_ratio = avg_win / abs(avg_loss) if avg_loss != 0 else 0
    
    # Calculate Win Rate
    total_days = len(data) - 1  # Exclude the first row as it doesn't have a previous value
    win_rate = win_count / total_days if total_days > 0 else 0
    
    # Get the last PnL value
    last_pnl_value = data['pnl'].iloc[-1] if len(data) > 0 else None
    
    return (biggest_win, biggest_loss, avg_win, avg_loss, risk_reward_ratio, 
            win_rate, longest_win_streak, longest_loss_streak, last_pnl_value)

# Example usage:
file_path = 'pnl_progression.csv'
biggest_win, biggest_loss, avg_win, avg_loss, risk_reward_ratio, win_rate, longest_win_streak, longest_loss_streak, last_pnl_value = calculate_win_loss_stats(file_path)

print(f"Biggest Win: {biggest_win:.2f}")
print(f"Biggest Loss: {biggest_loss:.2f}")
print(f"Average Win: {avg_win:.2f}")
print(f"Average Loss: {avg_loss:.2f}")
print(f"Risk-Reward Ratio: {risk_reward_ratio:.2f}")
print(f"Win Rate: {win_rate:.2%}")
print(f"Longest Win Streak: {longest_win_streak} days")
print(f"Longest Loss Streak: {longest_loss_streak} days")
print(f"Last PnL Value: {last_pnl_value:.2f}" if last_pnl_value is not None else "No PnL data available")

def calculate_all_markets():

    folder_path = 'backtest/pnl'
    file_paths = get_file_paths(folder_path)

    #clear the csv data file before writing to it it needs to be empty before writting the data
    with open('backtest/pnl_stats.csv', mode='w', newline='') as file:
        pass
    
    for file_path in file_paths:
        
        trading_pair = extract_trading_pair(file_path)
        print(trading_pair)
        file_path = f'backtest/pnl/{trading_pair}_pnl.csv'
        print(file_path)

        biggest_win, biggest_loss, avg_win, avg_loss, risk_reward_ratio, win_rate, longest_win_streak, longest_loss_streak, last_pnl_value = calculate_win_loss_stats(file_path)
        
        print(f"Biggest Win: {biggest_win:.2f}")
        print(f"Biggest Loss: {biggest_loss:.2f}")
        print(f"Average Win: {avg_win:.2f}")
        print(f"Average Loss: {avg_loss:.2f}")
        print(f"Risk-Reward Ratio: {risk_reward_ratio:.2f}")
        print(f"Win Rate: {win_rate:.2%}")
        print(f"Longest Win Streak: {longest_win_streak} days")
        print(f"Longest Loss Streak: {longest_loss_streak} days")
        print(f"Last PnL Value: {last_pnl_value:.2f}" if last_pnl_value is not None else "No PnL data available")
        print()

        # save the results to a csv file with all of the stats and values each trading pair
        with open('backtest/pnl_stats.csv', mode='a', newline='') as file:

            # Write the header if the file is empty
            if os.stat('backtest/pnl_stats.csv').st_size == 0:
                writer = csv.writer(file)
                writer.writerow(["Trading Pair", "Biggest Win", "Biggest Loss", "Average Win", "Average Loss", "Risk-Reward Ratio", "Win Rate", "Longest Win Streak", "Longest Loss Streak", "Last PnL Value"])

            writer = csv.writer(file)
            writer.writerow([trading_pair, biggest_win, biggest_loss, avg_win, avg_loss, risk_reward_ratio, win_rate, longest_win_streak, longest_loss_streak, last_pnl_value]) 

        
    # rank the trading pairs by pnl value on the csv file
    df = pd.read_csv('backtest/pnl_stats.csv')
    df = df.sort_values(by=['Last PnL Value'], ascending=False)
    df.to_csv('backtest/pnl_stats.csv', index=False)

if __name__ == "__main__":
    calculate_all_markets()