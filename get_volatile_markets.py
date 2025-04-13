import numpy as np
import csv
import json

from kline_utils import get_kline_data

def calculate_bollinger_bands_width_latest(kline_data, period=20):
    """
    Computes the latest Bollinger Bands Width (BBW) from kline data.

    :param kline_data: list - The kline data containing candlesticks with closing prices.
    :param period: int - The number of periods for the moving average and standard deviation. Default is 20.
    :return: float - The latest BBW value.
    """
    try:
        # Extract closing prices from kline data
        closing_prices = [float(candle[4]) for candle in kline_data]

        if len(closing_prices) < period:
            raise ValueError("Insufficient data to calculate Bollinger Bands.")

        # Use the latest period of closing prices
        window = closing_prices[-period:]
        sma = np.mean(window)  # Simple Moving Average
        std_dev = np.std(window)  # Standard Deviation

        upper_band = sma + 2 * std_dev
        lower_band = sma - 2 * std_dev
        bbw_value = (upper_band - lower_band) / sma

        return bbw_value
    except Exception as e:
        return {"error": str(e)}

def get_usdt_markets(file_path):
    """
    Load the USDT markets from a JSON file.

    :param file_path: str - Path to the JSON file.
    :return: list - List of USDT market symbols.
    """
    with open(file_path, 'r') as file:
        return json.load(file)

def save_to_csv(data, file_name):
    """
    Save the data to a CSV file.

    :param data: list - List of dictionaries containing market and BBW values.
    :param file_name: str - The name of the CSV file.
    """
    with open(file_name, mode='w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=['Market', 'BBW'])
        writer.writeheader()
        writer.writerows(data)


def get_volatile_markets():
    """
    Process USDT markets to calculate BBW values and save them to a CSV file.
    The file paths and dependencies are fixed within the function.
    """
    # Fixed paths
    usdt_markets_file = "usdt_markets.json"  # Path to your USDT markets JSON file
    output_csv_file = "usdt_markets_bbw.csv"

    # Load USDT markets
    usdt_markets = get_usdt_markets(usdt_markets_file)

    market_bbw_list = []

    for market in usdt_markets:
        try:
            # Fetch kline data for the market
            kline_data = get_kline_data(symbol=market, interval=240)

            # Check for errors in kline data
            if isinstance(kline_data, dict) and "error" in kline_data:
                print(f"Error fetching kline data for {market}: {kline_data['error']}")
                continue

            # Calculate the latest BBW value
            bbw_value = calculate_bollinger_bands_width_latest(kline_data)

            # Check if BBW value is valid
            if isinstance(bbw_value, dict) and "error" in bbw_value:
                print(f"Error calculating BBW for {market}: {bbw_value['error']}")
                continue

            market_bbw_list.append({"Market": market, "BBW": bbw_value})
        except Exception as e:
            print(f"Error processing {market}: {str(e)}")

    # Sort the list by BBW value in descending order
    market_bbw_list.sort(key=lambda x: x['BBW'], reverse=True)

    # Save the results to a CSV file
    save_to_csv(market_bbw_list, output_csv_file)
    print(f"BBW values saved to {output_csv_file}")




if __name__ == "__main__":
    usdt_markets_file = "usdt_markets.json"  # Path to your USDT markets JSON file
    output_csv_file = "usdt_markets_bbw.csv"

    # Load USDT markets
    usdt_markets = get_usdt_markets(usdt_markets_file)

    market_bbw_list = []

    for market in usdt_markets:
        try:
            # Fetch kline data for the market
            kline_data = get_kline_data(symbol=market, interval=240)

            # Check for errors in kline data
            if isinstance(kline_data, dict) and "error" in kline_data:
                print(f"Error fetching kline data for {market}: {kline_data['error']}")
                continue

            # Calculate the latest BBW value
            bbw_value = calculate_bollinger_bands_width_latest(kline_data)

            # Check if BBW value is valid
            if isinstance(bbw_value, dict) and "error" in bbw_value:
                print(f"Error calculating BBW for {market}: {bbw_value['error']}")
                continue

            market_bbw_list.append({"Market": market, "BBW": bbw_value})
        except Exception as e:
            print(f"Error processing {market}: {str(e)}")

    # Sort the list by BBW value in descending order
    market_bbw_list.sort(key=lambda x: x['BBW'], reverse=True)

    # Save the results to a CSV file
    save_to_csv(market_bbw_list, output_csv_file)
    print(f"BBW values saved to {output_csv_file}")
