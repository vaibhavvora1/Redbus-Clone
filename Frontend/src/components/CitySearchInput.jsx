import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin } from "lucide-react";
import api from "../services/api";

const RECENT_KEYS = {
  city: "redbus.recent-cities",
  train: "redbus.recent-stations",
};

function getRecent(variant) {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_KEYS[variant]) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored
      .filter((item) => item && typeof item.name === "string")
      .map((item) => ({
        ...item,
        type: variant === "train" ? (item.type || (item.code ? "station" : "city")) : "city",
      }))
      .slice(0, 5);
  } catch {
    return [];
  }
}

function itemKey(item, variant) {
  return variant === "train" && item.type === "station"
    ? `station-${item.code}`
    : `city-${item.slug || item.name.toLocaleLowerCase("en").replace(/\s+/g, "-")}`;
}

function labelFor(item, variant) {
  return variant === "train" && item.type === "station"
    ? `${item.name} (${item.code})`
    : item.name;
}

function searchValueFor(item, variant) {
  return variant === "train" && item.type === "station"
    ? item.code
    : item.slug || item.name;
}

function highlightMatch(text, query) {
  const cleanQuery = query.trim();
  const index = text.toLocaleLowerCase().indexOf(cleanQuery.toLocaleLowerCase());
  if (!cleanQuery || index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <strong className="font-bold text-gray-900">{text.slice(index, index + cleanQuery.length)}</strong>
      {text.slice(index + cleanQuery.length)}
    </>
  );
}

const CitySearchInput = forwardRef(function CitySearchInput(
  {
    id,
    label,
    variant,
    mode = "city",
    value = "",
    onChange,
    onSelect,
    onValidityChange,
    error = "",
    placeholder = "Search city",
    className = "",
    inputClassName = "",
    required = false,
  },
  ref
) {
  const searchVariant = variant || (mode === "station" ? "train" : "city");
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const popupRef = useRef(null);
  const activeRequestRef = useRef(null);
  const selectedRef = useRef(null);
  const timerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState(() => getRecent(searchVariant));
  const [position, setPosition] = useState({});
  const [localError, setLocalError] = useState("");

  const clearRequest = useCallback(() => {
    window.clearTimeout(timerRef.current);
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
  }, []);

  const loadItems = useCallback(async (query = "") => {
    clearRequest();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    setLoading(true);
    try {
      let data;
      if (searchVariant === "train" && query) {
        const response = await api.locations.getPlaces(
          { q: query, type: "train", limit: 20 },
          { signal: controller.signal }
        );
        data = (response.data || []).map((item) => ({ ...item, type: item.type || "city" }));
      } else if (searchVariant === "train") {
        const [stationsResponse, citiesResponse] = await Promise.all([
          api.locations.getStations({ limit: 8 }, { signal: controller.signal }),
          api.locations.getCities({ limit: 8 }, { signal: controller.signal }),
        ]);
        data = [
          ...(stationsResponse.data || []).map((item) => ({ ...item, type: "station" })),
          ...(citiesResponse.data || []).map((item) => ({ ...item, type: "city", city: item.name })),
        ];
      } else {
        const response = await api.locations.getCities(
          { q: query, limit: 20 },
          { signal: controller.signal }
        );
        data = (response.data || []).map((item) => ({ ...item, type: "city" }));
      }
      if (!controller.signal.aborted) {
        setItems(data);
        setActiveIndex(-1);
        setLocalError("");
      }
    } catch (requestError) {
      if (requestError.name !== "AbortError" && !controller.signal.aborted) {
        setItems([]);
        setLocalError("Suggestions could not be loaded. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [clearRequest, searchVariant]);

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    const openAbove = below < 270 && above > below;
    const maxHeight = Math.max(100, Math.min(320, (openAbove ? above : below) - 12));
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8));
    setPosition({
      position: "fixed",
      left,
      width: Math.min(rect.width, window.innerWidth - 16),
      maxHeight,
      zIndex: 1000,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => () => clearRequest(), [clearRequest]);

  useEffect(() => {
    const onDocumentPointer = (event) => {
      if (!rootRef.current?.contains(event.target) && !popupRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDocumentPointer);
    return () => document.removeEventListener("pointerdown", onDocumentPointer);
  }, []);

  const rawOptions = value.trim()
    ? items.map((item) => ({ ...item, section: "result" }))
    : [
        ...recent.map((item) => ({ ...item, section: "recent", recent: true })),
        ...items.map((item) => ({ ...item, section: "popular" })),
      ];
  const seenKeys = new Set();
  const options = rawOptions.filter((item) => {
    const key = itemKey(item, searchVariant);
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  const choose = useCallback((item) => {
    const selected = {
      ...item,
      value: labelFor(item, searchVariant),
      label: labelFor(item, searchVariant),
      searchValue: searchValueFor(item, searchVariant),
      type: item.type || "city",
    };
    selectedRef.current = selected;
    onChange?.(selected.value);
    onSelect?.(selected);
    onValidityChange?.(true);
    setLocalError("");
    setOpen(false);
    const storedItem = {
      type: selected.type,
      name: item.name,
      code: item.code,
      city: item.city,
      state: item.state,
      slug: item.slug,
    };
    const selectedKey = itemKey(storedItem, searchVariant);
    const nextRecent = [
      storedItem,
      ...recent.filter((recentItem) => itemKey(recentItem, searchVariant) !== selectedKey),
    ].slice(0, 5);
    setRecent(nextRecent);
    try {
      localStorage.setItem(RECENT_KEYS[searchVariant], JSON.stringify(nextRecent));
    } catch {
      setLocalError("Recent searches could not be saved.");
    }
  }, [onChange, onSelect, onValidityChange, recent, searchVariant]);

  const validate = useCallback(async () => {
    const term = value.trim();
    if (!term) {
      selectedRef.current = null;
      onValidityChange?.(false);
      setLocalError(required ? "Please select a location." : "");
      return null;
    }
    if (selectedRef.current && selectedRef.current.value.toLocaleLowerCase() === term.toLocaleLowerCase()) {
      return selectedRef.current;
    }

    try {
      let match;
      if (searchVariant === "train") {
        const cityResponse = await api.locations.getCities({ q: term, limit: 1, exact: true });
        if (cityResponse.data?.length) {
          match = { ...cityResponse.data[0], type: "city" };
        } else {
          const stationResponse = await api.locations.getStations({ q: term, limit: 1, exact: true });
          if (stationResponse.data?.length) {
            const station = stationResponse.data[0];
            const cityResponseForStation = await api.locations.getCities({
              q: station.city,
              limit: 1,
              exact: true,
            });
            const city = cityResponseForStation.data?.[0];
            match = {
              ...station,
              type: "station",
              state: city?.state || "",
              slug: city?.slug || "",
            };
          }
        }
      } else {
        const response = await api.locations.getCities({ q: term, limit: 1, exact: true });
        if (response.data?.length) match = { ...response.data[0], type: "city" };
      }
      if (match) {
        choose(match);
        return selectedRef.current;
      }
    } catch (requestError) {
      setLocalError(requestError.message || "Could not validate this location.");
      onValidityChange?.(false);
      return null;
    }

    selectedRef.current = null;
    onValidityChange?.(false);
    setLocalError("Select a location from the suggestions.");
    return null;
  }, [choose, onValidityChange, required, searchVariant, value]);

  useImperativeHandle(ref, () => ({ validate }), [validate]);

  const onInputChange = (event) => {
    const nextValue = event.target.value;
    selectedRef.current = null;
    onChange?.(nextValue);
    onValidityChange?.(false);
    setLocalError("");
    setOpen(true);
    window.clearTimeout(timerRef.current);
    activeRequestRef.current?.abort();
    if (!nextValue.trim()) {
      setItems([]);
      setLoading(false);
      loadItems("");
      return;
    }
    setLoading(true);
    timerRef.current = window.setTimeout(() => loadItems(nextValue.trim()), 250);
  };

  const onFocus = () => {
    setOpen(true);
    setLocalError("");
    loadItems(value.trim());
  };

  const onBlur = () => {
    window.setTimeout(() => {
      if (!rootRef.current?.contains(document.activeElement) &&
          !popupRef.current?.contains(document.activeElement)) {
        setOpen(false);
        if (value.trim()) validate();
      }
    }, 0);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown" && open && options.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
    } else if (event.key === "ArrowUp" && open && options.length) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? options.length - 1 : index - 1));
    } else if (event.key === "Enter" && open && options.length) {
      event.preventDefault();
      choose(options[activeIndex >= 0 ? activeIndex : 0]);
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const clearRecent = () => {
    setRecent([]);
    try {
      localStorage.removeItem(RECENT_KEYS[searchVariant]);
    } catch {
      setLocalError("Recent searches could not be cleared.");
    }
  };

  const optionId = (item) => `${id}-option-${itemKey(item, searchVariant)}`;
  const activeDescendant = activeIndex >= 0 && options[activeIndex]
    ? optionId(options[activeIndex])
    : undefined;
  const displayMessage = loading
    ? "Loading suggestions..."
    : value.trim() && options.length === 0
      ? searchVariant === "train" ? "No stations or cities found" : "No cities found"
      : "";

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {label && (
        <label htmlFor={id} className="mb-1 flex items-center gap-1 text-xs font-medium text-gray-500">
          <MapPin size={12} className="text-red-500" />
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-label={label || placeholder}
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={activeDescendant}
        aria-autocomplete="list"
        aria-invalid={Boolean(error || localError)}
        aria-required={required}
        autoComplete="off"
        value={value}
        onChange={onInputChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={`min-w-0 ${inputClassName}`}
      />
      {(error || localError) && (
        <p className="mt-1 text-xs text-red-600" role="alert">{error || localError}</p>
      )}
      {open && createPortal(
        <div
          ref={popupRef}
          style={position}
          className="city-dropdown-enter max-h-[min(20rem,70vh)] overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-xl"
        >
          <div
            id={`${id}-listbox`}
            role="listbox"
            aria-label={searchVariant === "train" ? "Station and city suggestions" : "City suggestions"}
          >
            {recent.length > 0 && (
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                <span className="text-xs font-semibold text-gray-500">Recent searches</span>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={clearRecent}
                  className="text-xs text-red-600 hover:underline"
                >
                  Clear
                </button>
              </div>
            )}
            {displayMessage ? (
              <div className="px-4 py-3 text-sm text-gray-500" role="status">{displayMessage}</div>
            ) : options.map((item, index) => {
              const isStation = searchVariant === "train" && item.type === "station";
              return (
                <button
                  key={`${item.section}-${itemKey(item, searchVariant)}`}
                  id={optionId(item)}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(item)}
                  className={`flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-red-50 ${
                    activeIndex === index ? "bg-red-50" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-800">
                      {highlightMatch(item.name, value)}
                      {isStation && <> <span className="text-gray-500">({highlightMatch(item.code, value)})</span></>}
                    </span>
                    <span className="block truncate text-xs text-gray-400">
                      {searchVariant === "train"
                        ? isStation
                          ? `${item.city || "City"}${item.state ? ` · ${item.state}` : ""} · Station`
                          : `${item.state || ""}${item.state ? " · " : ""}All stations`
                        : item.state}
                    </span>
                  </span>
                  {item.recent && <span className="shrink-0 text-[11px] text-gray-400">Recent</span>}
                </button>
              );
            })}
            {!displayMessage && options.length === 0 && !value.trim() && !loading && (
              <div className="px-4 py-3 text-sm text-gray-500" role="status">
                {searchVariant === "train" ? "No popular stations or cities yet" : "No popular cities yet"}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

export default CitySearchInput;
