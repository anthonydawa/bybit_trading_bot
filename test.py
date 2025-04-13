
import pandas as pd


final_data_save = f'backtest/best_values_bb/final_status_JELLYJELLYUSDT.csv'

#sort by pnl
df = pd.read_csv(final_data_save)
df = df.sort_values(by=['pnl'], ascending=False)
df.to_csv(final_data_save, index=False)