import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { signup } from '../api/auth';
import AppLayout from '../components/AppLayout';

export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    nickname: '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await signup(form);
      navigate('/login', {
        replace: true,
        state: {
          message: 'Signup completed. Please sign in.',
          email: form.email,
        },
      });
    } catch (error) {
      setErrorMessage(
        error?.response?.data?.message || error.message || 'Signup failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout
      eyebrow="Signup"
      title="Create a NeoSquare account"
      description="Create an account, then continue to the login page and sign in."
    >
      <form className="app-form" onSubmit={handleSignup}>
        <label className="app-field">
          <span>Nickname</span>
          <input
            className="app-input"
            type="text"
            name="nickname"
            value={form.nickname}
            onChange={handleChange}
            placeholder="How should others see you?"
            required
          />
        </label>
        <label className="app-field">
          <span>Email</span>
          <input
            className="app-input"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="app-field">
          <span>Password</span>
          <input
            className="app-input"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Create a password"
            required
          />
        </label>
        <div className="app-actions">
          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Signing up...' : 'Sign up'}
          </button>
          <Link className="text-link" to="/login">
            Back to login
          </Link>
        </div>
      </form>
      {errorMessage ? <p className="app-error">{errorMessage}</p> : null}
    </AppLayout>
  );
}
