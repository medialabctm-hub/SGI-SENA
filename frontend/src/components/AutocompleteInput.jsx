import { useState, useEffect, useRef } from 'react'
import { FiChevronDown, FiX } from 'react-icons/fi'
import '../styles/autocompleteInput.css'

export default function AutocompleteInput({
  value,
  onChange,
  onSelect,
  suggestions = [],
  placeholder = '',
  className = '',
  disabled = false,
  allowNew = true,
  onNewValue,
  minLength = 0,
  maxSuggestions = 10
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (value && value.length >= minLength) {
      const filtered = suggestions
        .filter(suggestion => {
          const suggestionText = typeof suggestion === 'string' ? suggestion : suggestion.label || suggestion.value || ''
          return suggestionText.toLowerCase().includes(value.toLowerCase())
        })
        .slice(0, maxSuggestions)
      
      // Si allowNew es true y el valor no está en las sugerencias, agregar opción "Agregar nuevo"
      if (allowNew && value.trim() && !filtered.some(s => {
        const sText = typeof s === 'string' ? s : s.label || s.value || ''
        return sText.toLowerCase() === value.toLowerCase()
      })) {
        filtered.push({ isNew: true, label: `Agregar "${value}"`, value: value })
      }
      
      setFilteredSuggestions(filtered)
      setIsOpen(filtered.length > 0)
    } else {
      setFilteredSuggestions([])
      setIsOpen(false)
    }
  }, [value, suggestions, minLength, maxSuggestions, allowNew])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e) => {
    const newValue = e.target.value
    onChange(newValue)
    setHighlightedIndex(-1)
  }

  const handleSelect = (suggestion) => {
    if (suggestion.isNew && onNewValue) {
      onNewValue(suggestion.value)
    } else {
      const selectedValue = typeof suggestion === 'string' ? suggestion : suggestion.value || suggestion.label || ''
      onChange(selectedValue)
      if (onSelect) {
        onSelect(selectedValue)
      }
    }
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e) => {
    if (!isOpen || filteredSuggestions.length === 0) {
      if (e.key === 'Enter' && allowNew && value.trim() && onNewValue) {
        onNewValue(value.trim())
        setIsOpen(false)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
          handleSelect(filteredSuggestions[highlightedIndex])
        } else if (allowNew && value.trim() && onNewValue) {
          onNewValue(value.trim())
          setIsOpen(false)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
      default:
        break
    }
  }

  const handleClear = () => {
    onChange('')
    setIsOpen(false)
    setHighlightedIndex(-1)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const getSuggestionText = (suggestion) => {
    if (typeof suggestion === 'string') return suggestion
    return suggestion.label || suggestion.value || ''
  }

  return (
    <div className={`autocomplete-wrapper ${className}`}>
      <div className="autocomplete-input-container">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (filteredSuggestions.length > 0) {
              setIsOpen(true)
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="autocomplete-input"
          autoComplete="off"
        />
        {value && !disabled && (
          <button
            type="button"
            className="autocomplete-clear"
            onClick={handleClear}
            aria-label="Limpiar"
          >
            <FiX size={16} />
          </button>
        )}
        <div className="autocomplete-arrow">
          <FiChevronDown size={18} />
        </div>
      </div>
      {isOpen && filteredSuggestions.length > 0 && (
        <div ref={dropdownRef} className="autocomplete-dropdown">
          {filteredSuggestions.map((suggestion, index) => {
            const text = getSuggestionText(suggestion)
            const isHighlighted = index === highlightedIndex
            const isNew = suggestion.isNew
            
            return (
              <div
                key={index}
                className={`autocomplete-option ${isHighlighted ? 'highlighted' : ''} ${isNew ? 'is-new' : ''}`}
                onClick={() => handleSelect(suggestion)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {isNew ? (
                  <>
                    <span className="autocomplete-new-icon">+</span>
                    <span>{text}</span>
                  </>
                ) : (
                  <span>{text}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}





