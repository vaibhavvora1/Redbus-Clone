import { List, CircleQuestionMark} from 'lucide-react';

export const leftnavLinks = [
  { label: "Bus Tickets", path: "/", icon: "/redbuslogo.png" },
  { label: "Train Tickets", path: "/trains", icon: "/train.png" },
  { label: "Hotels", path: "/hotels", icon: "/hotel.png" },
];

export const rightnavLinks = [
  { label: "Bookings", path: "/mybookings", icon: <List color="black" /> },
  { label: "Help", path: "/help", icon: <CircleQuestionMark color="black" /> },
];