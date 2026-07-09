import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FiChevronDown } from 'react-icons/fi'
import '../styles/components/customSelect.css'

/**
 * Componente personalizado de Select/Dropdown
 * 
 * Características:
 * - Compatible con formularios (maneja eventos onChange estándar)
 * - Navegación por teclado (Arrow keys, Enter, Escape, Tab)
 * - Accesible (ARIA attributes)
 * - Estilos consistentes con el diseño del proyecto
 * - Soporta opciones como array de strings o array de objetos
 * 
 * Ejemplo de uso básico:
 * ```jsx
 * <CustomSelect
 *   name="tipo"
 *   value={form.tipo}
 *   onChange={handleChange}
 *   options={['Opción 1', 'Opción 2', 'Opción 3']}
 *   placeholder="Seleccionar opción"
 * />
 * ```
 * 
 * Ejemplo con objetos y validación:
 * ```jsx
 * <CustomSelect
 *   name="tipo"
 *   value={form.tipo}
 *   onChange={handleChange}
 *   options={[
 *     { value: '1', label: 'Opción 1' },
 *     { value: '2', label: 'Opción 2' }
 *   ]}
 *   placeholder="Seleccionar tipo"
 *   required
 *   error={errores.tipo}
 *   helpText="Selecciona una opción de la lista"
 * />
 * ```
 * 
 * @param {Object} props
 * @param {string} props.name - Nombre del campo (para formularios)
 * @param {string} props.value - Valor seleccionado
 * @param {Function} props.onChange - Función callback cuando cambia el valor (recibe evento con e.target.name y e.target.value)
 * @param {Array} props.options - Array de opciones [{value: '', label: ''}] o array de strings
 * @param {string} props.placeholder - Texto placeholder (default: 'Seleccionar opción')
 * @param {boolean} props.disabled - Si está deshabilitado
 * @param {boolean} props.required - Si es requerido
 * @param {string} props.className - Clases CSS adicionales
 * @param {string} props.error - Mensaje de error a mostrar
 * @param {string} props.helpText - Texto de ayuda
 * @param {string} props.id - ID del elemento
 */
export default function CustomSelect({
  name,
  value = '',
  onChange,
  options = [],
  placeholder = 'Seleccionar opción',
  disabled = false,
  required = false,
  className = '',
  error = '',
  helpText = '',
  id,
  ...restProps
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState(null)
  const selectRef = useRef(null)
  const dropdownRef = useRef(null)

  // Normalizar opciones: acepta array de strings o array de objetos
  const normalizedOptions = options.map(option => {
    if (typeof option === 'string') {
      return { value: option, label: option }
    }
    return option
  })

  // Encontrar la opción seleccionada
  const selectedOption = normalizedOptions.find(opt => opt.value === value)

  // Calcular posición del dropdown al abrir (para Portal con position: fixed)
  useEffect(() => {
    if (!isOpen || disabled || !selectRef.current) {
      setDropdownPosition(null)
      return
    }
    const updatePosition = () => {
      if (!selectRef.current) return
      const rect = selectRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 180)
      })
    }
    updatePosition()
    // Pequeño delay por si el layout no ha pintado
    const t = requestAnimationFrame(updatePosition)
    return () => cancelAnimationFrame(t)
  }, [isOpen, disabled])

  // Cerrar al hacer scroll (de la página) o resize para evitar dropdown desfasado.
  // No cerrar si el scroll ocurre dentro del propio dropdown (lista de opciones).
  useEffect(() => {
    if (!isOpen) return
    const handleScroll = (e) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target)) return
      setIsOpen(false)
      setFocusedIndex(-1)
    }
    const handleResize = () => {
      setIsOpen(false)
      setFocusedIndex(-1)
    }
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen])

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false)
        setFocusedIndex(-1)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Manejar teclado
  const handleKeyDown = (e) => {
    if (disabled) return

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        } else if (focusedIndex >= 0) {
          handleSelect(normalizedOptions[focusedIndex].value)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setFocusedIndex(-1)
        selectRef.current?.blur()
        break
      case 'ArrowDown':
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
        } else {
          setFocusedIndex(prev => 
            prev < normalizedOptions.length - 1 ? prev + 1 : prev
          )
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (isOpen) {
          setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0))
        }
        break
      case 'Tab':
        setIsOpen(false)
        setFocusedIndex(-1)
        break
      default:
        break
    }
  }

  const handleSelect = (selectedValue) => {
    if (onChange) {
      // Simular evento para compatibilidad con formularios
      const syntheticEvent = {
        target: {
          name: name,
          value: selectedValue
        }
      }
      onChange(syntheticEvent)
    }
    setIsOpen(false)
    setFocusedIndex(-1)
  }

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
      if (!isOpen) {
        // Enfocar en la opción seleccionada o la primera
        const currentIndex = normalizedOptions.findIndex(opt => opt.value === value)
        setFocusedIndex(currentIndex >= 0 ? currentIndex : 0)
      }
    }
  }

  // Scroll a la opción enfocada
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && dropdownRef.current) {
      const focusedElement = dropdownRef.current.children[focusedIndex]
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [focusedIndex, isOpen])

  const selectId = id || `custom-select-${name || 'default'}`

  return (
    <div className={`custom-select-wrapper ${className}`}>
      <div
        ref={selectRef}
        className={`custom-select ${isOpen ? 'custom-select-open' : ''} ${
          error ? 'custom-select-error' : ''
        } ${disabled ? 'custom-select-disabled' : ''}`}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${selectId}-listbox`}
        aria-required={required}
        aria-invalid={!!error}
        id={selectId}
        {...restProps}
      >
        <span className="custom-select-value">
          {selectedOption ? selectedOption.label : (
            <span className="custom-select-placeholder">{placeholder}</span>
          )}
        </span>
        <FiChevronDown 
          className={`custom-select-arrow ${isOpen ? 'custom-select-arrow-open' : ''}`}
          size={18}
        />
      </div>

      {isOpen && !disabled && dropdownPosition && createPortal(
        <div
          ref={dropdownRef}
          className="custom-select-dropdown custom-select-dropdown-portal"
          role="listbox"
          id={`${selectId}-listbox`}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            minWidth: dropdownPosition.width
          }}
        >
          {normalizedOptions.length === 0 ? (
            <div className="custom-select-option custom-select-option-empty">
              No hay opciones disponibles
            </div>
          ) : (
            normalizedOptions.map((option, index) => {
              const isSelected = option.value === value
              const isFocused = index === focusedIndex

              return (
                <div
                  key={option.value}
                  className={`custom-select-option ${
                    isSelected ? 'custom-select-option-selected' : ''
                  } ${isFocused ? 'custom-select-option-focused' : ''}`}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  role="option"
                  aria-selected={isSelected}
                >
                  {option.label}
                </div>
              )
            })
          )}
        </div>,
        document.body
      )}

      {error && (
        <span className="custom-select-error-text">{error}</span>
      )}

      {helpText && !error && (
        <small className="custom-select-help-text">{helpText}</small>
      )}
    </div>
  )
}

