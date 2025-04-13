import csv
import os
from long_term_trend import get_trend  # Replace 'your_module' with the actual module name where get_trend is defined.

def get_qualified_markets(sessions_to_check, check_rsi=True, check_trend=True, excluded_markets=None):
    """
    Identify qualified markets for trades based on trendline slopes, RSI conditions, and trend analysis.

    :param sessions_to_check: list, sessions to evaluate (e.g., ["tokyo", "sydney"])
    :param check_rsi: bool, whether to include RSI conditions in filtering
    :param check_trend: bool, whether to include trend analysis in filtering
    :param excluded_markets: list, markets to exclude from the final lists
    """
    # File paths
    trendline_file = "market_trendline_slopes.csv"
    rsi_file = "rsi_evaluation_results.csv"
    long_trades_file = os.path.join("buy_trades", "base_long_trades.csv")
    short_trades_file = os.path.join("sell_trades", "base_short_trades.csv")

    # Ensure directories exist
    os.makedirs("buy_trades", exist_ok=True)
    os.makedirs("sell_trades", exist_ok=True)

    long_trades = []
    short_trades = []

    # Normalize excluded_markets for quick lookup
    excluded_markets = set(excluded_markets or [])

    # Load RSI data into a dictionary for quick lookup
    rsi_data = {}
    with open(rsi_file, mode="r") as file:
        rsi_reader = csv.DictReader(file)
        for row in rsi_reader:
            key = (row["Market"], row["Session"])
            rsi_data[key] = row["RSI Level"]

    # Load trendline slopes into a dictionary for quick lookup
    trendline_data = {}
    with open(trendline_file, mode="r") as file:
        trendline_reader = csv.DictReader(file)
        for row in trendline_reader:
            market = row["Market Symbol"]
            session = row["Session"]
            try:
                slope = float(row["Trendline Slope"])
            except ValueError:
                print(f"Skipping invalid slope value for market: {market}, session: {session}")
                continue

            if market not in trendline_data:
                trendline_data[market] = {}
            trendline_data[market][session] = slope

    # Process markets and check criteria
    for market, session_data in trendline_data.items():
        # Skip excluded markets
        if market in excluded_markets:
            continue

        # Check if all sessions to check are present in the data
        if not all(session in session_data for session in sessions_to_check):
            continue

        # Check if all slopes are positive or all are negative
        slopes = [session_data[session] for session in sessions_to_check]
        all_positive = all(slope > 0 for slope in slopes)
        all_negative = all(slope < 0 for slope in slopes)

        if not (all_positive or all_negative):
            continue  # Skip if slopes are mixed

        # Check RSI conditions if enabled
        if check_rsi:
            rsi_conditions_long = all(rsi_data.get((market, session), "") != "overbought" for session in sessions_to_check)
            rsi_conditions_short = all(rsi_data.get((market, session), "") != "oversold" for session in sessions_to_check)
        else:
            rsi_conditions_long = rsi_conditions_short = True

        # Final trend qualification if enabled
        if check_trend:
            trend = get_trend(symbol=market, interval="240")  # Use the 4-hour timeframe
        else:
            trend = None  # Disable trend filtering

        if all_positive and rsi_conditions_long and (not check_trend or trend == "long"):
            long_trades.append((market, sessions_to_check[0], slopes[0]))  # Use the first session for simplicity
        elif all_negative and rsi_conditions_short and (not check_trend or trend == "short"):
            short_trades.append((market, sessions_to_check[0], slopes[0]))  # Use the first session for simplicity

    # Sort long trades: highest positive slope first
    long_trades.sort(key=lambda x: abs(x[2]), reverse=True)

    # Sort short trades: highest absolute magnitude of slope first
    short_trades.sort(key=lambda x: abs(x[2]), reverse=True)

    # Save long trades
    with open(long_trades_file, mode="w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["Market", "Session", "Trendline Slope"])
        writer.writerows(long_trades)

    # Save short trades
    with open(short_trades_file, mode="w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["Market", "Session", "Trendline Slope"])
        writer.writerows(short_trades)

    print(f"Long trades saved to: {long_trades_file}")
    print(f"Short trades saved to: {short_trades_file}")

def sort_csv_by_column(file_path, column_name):
    """
    Sort a CSV file by the specified column in descending order.

    :param file_path: str, path to the CSV file
    :param column_name: str, name of the column to sort by
    """
    # Read the CSV data
    with open(file_path, mode="r") as file:
        reader = csv.DictReader(file)
        rows = list(reader)

    # Check if the column exists
    if column_name not in reader.fieldnames:
        print(f"Column '{column_name}' not found in the CSV.")
        return

    # Sort rows based on the specified column (by value, in descending order)
    try:
        rows.sort(key=lambda x: float(x[column_name]), reverse=True)
    except ValueError:
        print(f"Error: Unable to sort by column '{column_name}' due to invalid data.")
        return

    # Write the sorted data back to the CSV
    with open(file_path, mode="w", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=reader.fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"CSV file sorted by column '{column_name}' and saved to: {file_path}")

if __name__ == "__main__":
    excluded_markets_list = ["USDEUSDT", "USDCUSDT"]  # Replace with actual markets to exclude
    get_qualified_markets(["tokyo", "sydney"], check_rsi=False, check_trend=False, excluded_markets=excluded_markets_list)