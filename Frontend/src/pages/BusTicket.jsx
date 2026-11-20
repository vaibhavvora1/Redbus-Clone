import SearchBar from '../components/Searchbar'
import Festivaloffers from '../components/Festivaloffers'
import {useRef} from "react"
import OffersSection from '../components/Offersection'
import WhatsNew from '../components/Whatsnew'
import GovernmentBuses from '../components/Governmentbus'
import Testimonials from '../components/Testimoniols'
import AppDownloadBanner from '../components/Appdownloadbanner'
import InfoSection from '../components/Infosection'
import Footer from '../components/Footer'
import Reveal from "../components/Reveal"
import TravelServiceCards from "../components/TravelServiceCards"
import { BusFront } from "lucide-react"

const BusTicket = () => {
     const heroRef = useRef(null);
  return (
    <div className='max-w-full'>
        <div ref={heroRef}>
        {/* Hero Section */}
        <div
          className="hero-banner relative bg-cover bg-center h-[420px] flex items-center px-6 md:px-16 overflow-hidden"
          style={{ backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.65), rgba(0,0,0,0.25)), url('/HomeBanner.webp')" }}
        >
          <div className="hero-route" aria-hidden="true">
            <BusFront className="hero-route-bus" size={28} />
          </div>
          <div className="max-w-6xl mx-auto w-full">
            <h1 className="hero-title text-white text-4xl md:text-6xl font-extrabold text-left drop-shadow-lg max-w-2xl leading-tight">
              India's No. 1 online<br />bus ticket booking site
            </h1>
          </div>
        </div>

        {/* Search Bar (needs to overlap the hero, so it keeps its own max-width + negative margin) */}
        <div className="search-card-enter max-w-6xl mx-auto px-4 -mt-16 relative z-30">
          <SearchBar />
        </div>

        {/* Full-width content below */}
        <Reveal><TravelServiceCards /></Reveal>
        <Reveal><Festivaloffers /></Reveal>
        <Reveal><OffersSection /></Reveal>
        <Reveal><WhatsNew /></Reveal>
        <Reveal><GovernmentBuses /></Reveal>
        <Reveal><Testimonials /></Reveal>
        <Reveal><AppDownloadBanner /></Reveal>
        <Reveal><InfoSection /></Reveal>
        <Footer/>

    </div>
    </div>
  )
}

export default BusTicket