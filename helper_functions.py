import csv

import csv

def find_pair_markets(file1_path, file2_path, output_file_path):
    """
    Compares two CSV files and finds rows where the 'Market' column matches in both files.

    Args:
        file1_path (str): Path to the first CSV file.
        file2_path (str): Path to the second CSV file.
        output_file_path (str): Path to save the output CSV file with matching rows.
    """
    try:
        # Read the first file and store its markets in a set for quick lookup
        with open(file1_path, 'r') as file1:
            reader1 = csv.DictReader(file1)
            file1_markets = {row['Market'] for row in reader1}

        # Read the second file and find matches
        matching_rows = []
        with open(file2_path, 'r') as file2:
            reader2 = csv.DictReader(file2)
            headers = reader2.fieldnames

            for row in reader2:
                if row['Market'] in file1_markets:
                    matching_rows.append(row)

        # Write the matching rows to the output file
        if matching_rows:
            with open(output_file_path, 'w', newline='') as output_file:
                writer = csv.DictWriter(output_file, fieldnames=headers)
                writer.writeheader()
                writer.writerows(matching_rows)

            print(f"Matching rows saved to {output_file_path}")
        else:
            print("No matching rows found.")

    except Exception as e:
        print(f"An error occurred: {e}")

# Example usage:
# compare_csv_files('file1.csv', 'file2.csv', 'output.csv')


def compare_csv_rows():
    # File paths
    long_trades_path = "buy_trades/base_long_trades.csv"
    short_trades_path = "sell_trades/base_short_trades.csv"

    # Count rows in long_trades.csv
    with open(long_trades_path, 'r') as long_file:
        long_reader = csv.reader(long_file)
        long_rows = sum(1 for _ in long_reader) - 1  # Subtract 1 for the header row

    # Count rows in short_trades.csv
    with open(short_trades_path, 'r') as short_file:
        short_reader = csv.reader(short_file)
        short_rows = sum(1 for _ in short_reader) - 1  # Subtract 1 for the header row

    # Compare and return result
    if long_rows > short_rows:
        return "Buy"
    elif short_rows > long_rows:
        return "Sell"
    else:
        return "Equal"

# Example usage

import csv

def remove_session_from_csv(file_name, session_name):
    try:
        # Read the file content
        with open(file_name, 'r') as file:
            reader = csv.reader(file)
            headers = next(reader)  # Extract headers
            rows = [row for row in reader if row[1].strip().lower() != session_name.strip().lower()]

        # Write back the filtered content
        with open(file_name, 'w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(headers)  # Write headers
            writer.writerows(rows)   # Write filtered rows

        print(f"Rows with session '{session_name}' removed successfully.")
    except FileNotFoundError:
        print(f"Error: The file '{file_name}' was not found.")
    except Exception as e:
        print(f"An error occurred: {e}")


import pandas as pd

def remove_lower_half(file_path):
    """
    Removes the lower half of the data in a CSV file and saves the changes.

    Parameters:
        file_path (str): The path to the CSV file.
    """
    # Read the CSV file into a DataFrame
    df = pd.read_csv(file_path)

    # Calculate the halfway point (rounding down if odd number of rows)
    half_index = len(df) // 2

    # Keep only the upper half of the DataFrame
    df_upper_half = df.iloc[:half_index]

    # Save the updated DataFrame back to the original file
    df_upper_half.to_csv(file_path, index=False)

    print(f"The lower half of the data has been removed and changes saved to '{file_path}'.")

import csv

def remove_symbol(symbol, filepath):
    """
    Removes a row with the given symbol from a CSV file.
    
    :param symbol: The symbol to remove
    :param filepath: The path to the CSV file
    """
    updated_rows = []
    
    with open(filepath, mode='r', newline='', encoding='utf-8') as file:
        reader = csv.reader(file)
        header = next(reader, None)  # Read the header safely
        if header:
            updated_rows.append(header)
        
        for row in reader:
            if row and row[0] != symbol:  # Ensure row is not empty and check the first column
                updated_rows.append(row)
    
    with open(filepath, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerows(updated_rows)
    
    print(f"Symbol '{symbol}' removed from {filepath}.")

def add_symbol(symbol, filepath):
    """
    Adds a row with the given symbol to a CSV file if it does not already exist.
    
    :param symbol: The symbol to add
    :param filepath: The path to the CSV file
    """
    existing_symbols = set()
    rows = []
    
    with open(filepath, mode='r', newline='', encoding='utf-8') as file:
        reader = csv.reader(file)
        header = next(reader, None)  # Read the header safely
        if header:
            rows.append(header)
        
        for row in reader:
            if row:
                existing_symbols.add(row[0])
                rows.append(row)
    
    if symbol not in existing_symbols:
        new_row = [symbol, 1, "none", "closed", 1, False, False, False]
        rows.append(new_row)
        
        with open(filepath, mode='w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerows(rows)
        
        print(f"Symbol '{symbol}' added to {filepath}.")
    else:
        print(f"Symbol '{symbol}' already exists in {filepath}.")

def count_open_symbols(filepath):
    """
    Counts the number of symbols with an 'open' status in a CSV file.
    
    :param filepath: The path to the CSV file
    :return: The count of symbols with 'open' status
    """
    count = 0
    
    with open(filepath, mode='r', newline='', encoding='utf-8') as file:
        reader = csv.reader(file)
        header = next(reader, None)  # Skip the header
        
        for row in reader:
            if row and row[3].strip().lower() == "open":  # Check if the status column is 'open'
                count += 1
    
    return count

if __name__ == "__main__":
    print(count_open_symbols("markets.csv"))
    # remove_lower_half('buy_trades/long_trades.csv')
    # remove_lower_half('sell_trades/short_trades.csv')
    # remove_session_from_csv('sell_trades/short_trades.csv','tokyo')
    # remove_session_from_csv('buy_trades/long_trades.csv','tokyo')
    # find_pair_markets('buy_trades/long_trades.csv','usdt_markets_bbw.csv','buy_trades/volatile_long_trades.csv')
    # find_pair_markets('sell_trades/short_trades.csv','usdt_markets_bbw.csv','sell_trades/volatile_short_trades.csv')
