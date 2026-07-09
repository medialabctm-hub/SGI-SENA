import { useState } from 'react';

export const useForm = (initialValues = {}) => {
  const [form, setForm] = useState(initialValues);
  const [errores, setErrores] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errores[name]) {
      setErrores((prev) => ({ ...prev, [name]: null }));
    }
  };

  const resetForm = (newValues = initialValues) => {
    setForm(newValues);
    setErrores({});
  };

  const setFieldValue = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errores[name]) {
      setErrores((prev) => ({ ...prev, [name]: null }));
    }
  };

  return {
    form,
    setForm,
    errores,
    setErrores,
    handleChange,
    resetForm,
    setFieldValue,
  };
};

