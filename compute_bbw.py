import numpy as np

from kline_utils import get_kline_data

import numpy as np

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

# Example usage
if __name__ == "__main__":
    # Fetch kline data using your function
    kline_data = get_kline_data(symbol="BTCUSDT", interval=240)

    # Check if kline_data contains an error
    if isinstance(kline_data, dict) and "error" in kline_data:
        print("Error fetching kline data:", kline_data["error"])
    else:
        # Calculate the latest Bollinger Bands Width
        bbw_value = calculate_bollinger_bands_width_latest(kline_data)
        print("Latest Bollinger Bands Width:", bbw_value)
