import os
import pandas as pd

def get_highest_pnl_from_file(file_path):
    df = pd.read_csv(file_path)
    if 'pnl' in df.columns:
        highest_pnl_row = df.loc[df['pnl'].idxmax()]
    else:
        raise KeyError(f"'pnl' column not found in {file_path}")
    return highest_pnl_row

def get_highest_pnl_from_folder(folder_path):
    results = []
    for filename in os.listdir(folder_path):
        if filename.endswith('.csv'):
            file_path = os.path.join(folder_path, filename)
            try:
                highest_pnl_row = get_highest_pnl_from_file(file_path)
                results.append(highest_pnl_row)
            except KeyError as e:
                print(e)
    
    if results:
        results_df = pd.DataFrame(results)
        results_df = results_df.sort_values(by='pnl', ascending=False)
        output_path = os.path.join('backtest', 'highest_pnls.csv')
        results_df.to_csv(output_path, index=False)

if __name__ == "__main__":
    folder_path = 'backtest/best_values_bb'
    get_highest_pnl_from_folder(folder_path)