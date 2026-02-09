import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Superadmin from "./pages/Superadmin";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute minRole="USER">
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="sales" element={<Sales />} />
          <Route
            path="users"
            element={
              <ProtectedRoute minRole="ADMIN">
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute minRole="ADMIN">
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="super"
            element={
              <ProtectedRoute minRole="SUPERADMIN">
                <Superadmin />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<div className="container"><div className="card">404</div></div>} />
      </Routes>
    </AuthProvider>
  );
}
