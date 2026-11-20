
import Navbar from './components/Navbar'
import AppRoutes from './Routes/App.Routes'
import { AuthProvider } from './context/AuthContext'
import { BookingProvider } from './context/BookingContext'

const App = () => {
  return (
    <AuthProvider>
      <BookingProvider>
        <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
          <div>
            <Navbar />
            <AppRoutes />
          </div>
        </div>
      </BookingProvider>
    </AuthProvider>
  )
}

export default App