import pandas as pd
import matplotlib.pyplot as plt

# Load data from CSV file
try:
    df = pd.read_csv("backtest/pnl_bb/BUZZUSDT_pnl.csv", parse_dates=["timestamp"])
except ValueError as e:
    print(f"Error loading CSV: {e}")
    df = pd.read_csv("backtest/pnl_bb/BUZZUSDT_pnl.csv")

# Load data from CSV file without headers
try:
    df = pd.read_csv("backtest/pnl_bb/BUZZUSDT_pnl.csv", header=None, names=["timestamp", "pnl"], parse_dates=["timestamp"])
except ValueError as e:
    print(f"Error loading CSV: {e}")
    df = pd.read_csv("backtest/pnl_bb/BUZZUSDT_pnl.csv", header=None, names=["timestamp", "pnl"])

# Calculate statistical insights
mean_pnl = df["pnl"].mean()
median_pnl = df["pnl"].median()
std_pnl = df["pnl"].std()
min_pnl = df["pnl"].min()
max_pnl = df["pnl"].max()

# Print insights
print("Trading PnL Insights:")
print(f"Mean PnL: {mean_pnl:.2f}")
print(f"Median PnL: {median_pnl:.2f}")
print(f"Standard Deviation: {std_pnl:.2f}")
print(f"Min PnL: {min_pnl:.2f}")
print(f"Max PnL: {max_pnl:.2f}")

# Plot the PnL progression
plt.figure(figsize=(10, 5))
plt.plot(df["timestamp"], df["pnl"], marker='o', linestyle='-', color='b', label="PnL")

# Plot statistical values
plt.axhline(mean_pnl, color='r', linestyle='--', label=f"Mean PnL: {mean_pnl:.2f}")
plt.axhline(median_pnl, color='g', linestyle='--', label=f"Median PnL: {median_pnl:.2f}")
plt.axhline(mean_pnl + std_pnl, color='y', linestyle='--', label=f"Mean + Std: {mean_pnl + std_pnl:.2f}")
plt.axhline(mean_pnl - std_pnl, color='y', linestyle='--', label=f"Mean - Std: {mean_pnl - std_pnl:.2f}")
plt.axhline(min_pnl, color='c', linestyle='--', label=f"Min PnL: {min_pnl:.2f}")
plt.axhline(max_pnl, color='m', linestyle='--', label=f"Max PnL: {max_pnl:.2f}")

# Formatting
plt.xlabel("Time")
plt.ylabel("PnL Value")
plt.title("Trading PnL Progression Over Time")
plt.xticks(rotation=45)
plt.legend()
plt.grid()

# Show plot
plt.show()
