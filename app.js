import React, { useState, useEffect } from "react";
import "./style.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  function calcLiveHours(shift, hours) {
    if (!shift) return 0;
    if (shift.includes("-")) return hours || 0;

    const match = shift.match(/(\d{1,2})(?::(\d{2}))?/);
    if (!match) return hours || 0;

    const startHour = parseInt(match[1], 10);
    const startMin = parseInt(match[2] || "0", 10);

    const now = new Date();
    const start = new Date(now);
    start.setHours(startHour);
    start.setMinutes(startMin);

    let diff = (now - start) / 3600000;
    if (diff < 0) diff += 24;

    return Math.round(diff * 10) / 10;
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value.trim();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `https://script.google.com/macros/s/AKfycbw8qIYHFAkLKq5zDbjhAkmFyHPaR9Ib01C32gP3uRo1m3dVYjD/exec?action=login&email=${email}&password=${password}`
      );
      const data = await res.json();

      if (!data.ok) throw new Error("Invalid email or password");
      setUser(data);
      fetchSchedule(email);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSchedule(email) {
    setLoading(true);
    try {
      const res = await fetch(
        `https://script.google.com/macros/s/AKfycbw8qIYHFAkLKq5zDbjhAkmFyHPaR9Ib01C32gP3uRo1m3dVYjD/exec?action=getSmartSchedule&email=${email}`
      );
      const data = await res.json();
      if (data.ok) setSchedule(data);
      else setError("Could not load schedule");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setUser(null);
    setSchedule(null);
  }

  function calcTotalWithLive(days) {
    return days
      .reduce((sum, d) => sum + (calcLiveHours(d.shift, d.hours) || 0), 0)
      .toFixed(1);
  }

  if (!user) {
    return (
      <div className="container">
        <h1>ALLSTON CAR WASH</h1>
        <form onSubmit={handleLogin}>
          <input type="email" name="email" placeholder="Email" required />
          <input type="password" name="password" placeholder="Password" required />
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        <p className="footer">
          Powered by <b>JAG15</b> | Allston Car Wash © 2025
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <h2>{schedule?.name || user.name}</h2>
      <p className="role">{user.role}</p>
      <p>Week of {schedule?.week}</p>

      <table>
        <thead>
          <tr>
            <th>Day</th>
            <th>Shift</th>
            <th>Hours</th>
          </tr>
        </thead>
        <tbody>
          {schedule?.days?.map((day, i) => {
            const today = new Date().toLocaleDateString("en-US", { weekday: "short" });
            const isToday = today === day.name;
            const live = calcLiveHours(day.shift, day.hours);
            const displayHours = isToday && day.shift.endsWith(".") ? live : day.hours;

            return (
              <tr key={i}>
                <td>{day.name}</td>
                <td>{day.shift || "-"}</td>
                <td>
                  {day.shift?.endsWith(".") && isToday ? (
                    <span>⏱️ {displayHours}</span>
                  ) : (
                    displayHours
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="total">
        Total Hours: <b>{calcTotalWithLive(schedule.days)}</b>
      </p>
      <p className="clock">🕓 {now.toLocaleTimeString()}</p>

      <div className="settings-box">
        <button onClick={handleLogout} className="logout">
          Log Out
        </button>
        <p className="footer">
          Powered by <b>JAG15</b> | Allston Car Wash © 2025<br />
          v4.7 — Live Blue Glass Edition
        </p>
      </div>
    </div>
  );
}
