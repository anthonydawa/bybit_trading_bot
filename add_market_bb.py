import csv
import os

def add_market_data(destination_file, symbol, source_folder='backtest/best_values_bb'):
    # Search for the file that contains the symbol in the source folder
    get_file_path = None
    for file_name in os.listdir(source_folder):
        if symbol in file_name:
            get_file_path = os.path.join(source_folder, file_name)
            break
    
    if get_file_path is None:
        raise FileNotFoundError(f"No file containing the symbol {symbol} found in the folder {source_folder}.")

    # Read the topmost data from the get_file_path
    with open(get_file_path, mode='r') as get_file:
        reader = csv.DictReader(get_file)
        topmost_data = next(reader, None)
        
        if topmost_data is None or topmost_data['market'] != symbol:
            raise ValueError(f"Symbol {symbol} not found in the source file or the file is empty.")
        
        market_data = {
            'symbol': topmost_data['market'],
            'qty': 0,
            'position': 'none',
            'stop_loss': 0,
            'take_profit': 0,
            'bbw': topmost_data['BBW_THRESHOLD'],
            'tp_atr_multiplier': topmost_data['ATR_MULTIPLIER_TP'],
            'sl_atr_multiplier': topmost_data['ATR_MULTIPLIER_SL'],
            'bb_period': topmost_data['BB_PERIOD'],
            'bb_dev': topmost_data['BB_STD_DEV']
        }

    # Check if the symbol already exists in the destination file
    try:
        with open(destination_file, mode='r') as add_file:
            reader = csv.DictReader(add_file)
            for row in reader:
                if row['symbol'] == symbol:
                    print(f"Symbol {symbol} already exists in the file. Skipping addition.")
                    return
    except FileNotFoundError:
        # File does not exist, so we will create it
        pass

    # Append the data to the destination file
    with open(destination_file, mode='a', newline='') as add_file:
        fieldnames = ['symbol', 'qty', 'position', 'stop_loss', 'take_profit', 'bbw', 'tp_atr_multiplier', 'sl_atr_multiplier', 'bb_period', 'bb_dev']
        writer = csv.DictWriter(add_file, fieldnames=fieldnames)
        
        # Check if the file is empty to write the header
        add_file.seek(0, 2)  # Move the cursor to the end of the file
        if add_file.tell() == 0:
            writer.writeheader()
        
        writer.writerow(market_data)

# Example usage:
add_market_data('markets_bb.csv', 'SHELLUSDT')
