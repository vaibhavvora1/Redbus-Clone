import { Link } from "react-router-dom";
import { Bus } from "lucide-react";

const NotFound = () => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <Bus size={64} className="text-red-500 mb-6" />
      <h1 className="text-6xl font-bold text-gray-800 mb-2">404</h1>
      <p className="text-xl font-semibold text-gray-700 mb-2">
        Oops! Looks like this route doesn't exist.
      </p>
      <p className="text-gray-500 mb-8 max-w-md">
        The page you're looking for might have been moved, deleted, or never
        existed. Let's get you back on track.
      </p>
      <Link
        to="/"
        className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-full transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
};

export default NotFound;