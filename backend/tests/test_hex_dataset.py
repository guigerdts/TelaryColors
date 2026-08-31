"""Pantone HEX dataset unit tests — lookup, normalization, gamut scoping.

Covers the static ``hex_dataset`` module that maps Pantone C-coated numeric
codes to their publicly published sRGB hex approximations.
"""

from app.modules.pantone_colors.hex_dataset import HEX_BY_CODE, lookup_hex_code, suggest_hex


class TestSuggestHex:
    """``suggest_hex(code, gamut)`` — best-effort C→HEX lookup with gamut gate."""

    def test_exact_match_211(self) -> None:
        assert suggest_hex("211", "C") == "#f57eb6"

    def test_exact_match_281(self) -> None:
        assert suggest_hex("281", "C") == "#00205b"

    def test_exact_match_186(self) -> None:
        assert suggest_hex("186", "C") == "#c8102e"

    def test_exact_match_287(self) -> None:
        assert suggest_hex("287", "C") == "#003087"

    def test_exact_match_1235(self) -> None:
        assert suggest_hex("1235", "C") == "#ffb81c"

    def test_no_match_returns_none(self) -> None:
        assert suggest_hex("99999", "C") is None

    def test_empty_code_returns_none(self) -> None:
        assert suggest_hex("", "C") is None

    def test_gamut_U_returns_none(self) -> None:
        """Only C-coated codes are in the dataset; other gamuts return None."""
        assert suggest_hex("211", "U") is None

    def test_gamut_TPX_returns_none(self) -> None:
        assert suggest_hex("211", "TPX") is None

    def test_normalization_trailing_C_uppercase(self) -> None:
        assert suggest_hex("211C", "C") == "#f57eb6"

    def test_normalization_trailing_C_lowercase(self) -> None:
        assert suggest_hex("211c", "C") == "#f57eb6"

    def test_normalization_trailing_space_C(self) -> None:
        assert suggest_hex("211 C", "C") == "#f57eb6"

    def test_normalization_whitespace(self) -> None:
        assert suggest_hex(" 211 ", "C") == "#f57eb6"


class TestDatasetCoverage:
    """Verify that key Pantone C-coated codes are present in the dict."""

    def test_281_present(self) -> None:
        assert "281" in HEX_BY_CODE

    def test_211_present(self) -> None:
        assert "211" in HEX_BY_CODE

    def test_186_present(self) -> None:
        assert "186" in HEX_BY_CODE


class TestLookupHexCode:
    """``lookup_hex_code(code)`` — raw lookup without gamut gating."""

    def test_returns_hex_for_known_code(self) -> None:
        assert lookup_hex_code("211") == "#f57eb6"

    def test_returns_none_for_unknown(self) -> None:
        assert lookup_hex_code("99999") is None

    def test_strips_whitespace(self) -> None:
        assert lookup_hex_code("  211  ") == "#f57eb6"
