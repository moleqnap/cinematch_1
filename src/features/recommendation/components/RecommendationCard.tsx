import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Star, Calendar, Target, Info, ExternalLink, Bookmark, BookMarked, Sparkles, Zap, SkipForward, Users, Film, Award, Tag } from 'lucide-react';
import { tmdbService } from '../../content/services/tmdb';
import type { Recommendation, Genre } from '../types';

interface RecommendationCardProps {
  recommendation: Recommendation;
  genres: Genre[];
  onRate: (rating: number | 'not_watched' | 'not_interested' | 'skip', mediaType?: 'movie' | 'tv') => void;
  userRating: number | 'not_watched' | 'not_interested' | 'skip' | null;
  isInWatchlist?: boolean;
  onAddToWatchlist?: () => void;
  onRemoveFromWatchlist?: () => void;
  showReasons?: boolean;
  showMatchScore?: boolean;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = React.memo(({
  recommendation,
  genres,
  onRate,
  userRating,
  isInWatchlist = false,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  showReasons = true,
  showMatchScore = true
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [movieDetails, setMovieDetails] = useState<any>(null);
  const [loadingTrailer, setLoadingTrailer] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [tempRating, setTempRating] = useState<number>(0);

  const { movie, matchScore, reasons } = recommendation;

  // Sync tempRating with userRating when userRating changes
  useEffect(() => {
    if (typeof userRating === 'number') {
      setTempRating(userRating);
    } else {
      setTempRating(0);
    }
  }, [userRating]);
  const isTV = useMemo(() => movie.media_type === 'tv' || 'name' in movie, [movie.media_type, movie]);
  const title = useMemo(() => {
    if (isTV) {
      return (
        (movie as any).name ||
        (movie as any).original_name ||
        ''
      );
    } else {
      return (
        (movie as any).title ||
        (movie as any).original_title ||
        ''
      );
    }
  }, [isTV, movie]);

  const handleDetailsClick = useCallback(async () => {
    if (!movieDetails && !loadingDetails) {
      setLoadingDetails(true);
      try {
        const details = isTV 
          ? await tmdbService.getTVShowDetails(movie.id)
          : await tmdbService.getMovieDetails(movie.id);
        setMovieDetails(details);
      } catch (error) {
        console.error('Error loading details:', error);
      } finally {
        setLoadingDetails(false);
      }
    }
    setShowDetails(true);
  }, [movieDetails, loadingDetails, isTV, movie.id]);

  const handleTrailerClick = useCallback(async () => {
    setLoadingTrailer(true);
    try {
      if (!movieDetails) {
        const details = isTV 
          ? await tmdbService.getTVShowDetails(movie.id)
          : await tmdbService.getMovieDetails(movie.id);
        setMovieDetails(details);
        
        if (details?.videos?.results) {
          const trailerKey = getTrailerKey(details);
          if (trailerKey) {
            openYouTubeInNewTab(trailerKey);
          } else {
            window.open(`https://www.themoviedb.org/${isTV ? 'tv' : 'movie'}/${movie.id}`, '_blank', 'noopener,noreferrer');
          }
        }
      } else {
        const trailerKey = getTrailerKey(movieDetails);
        if (trailerKey) {
          openYouTubeInNewTab(trailerKey);
        } else {
          window.open(`https://www.themoviedb.org/${isTV ? 'tv' : 'movie'}/${movie.id}`, '_blank', 'noopener,noreferrer');
        }
      }
    } catch (error) {
      console.error('Error loading trailer:', error);
      window.open(`https://www.themoviedb.org/${isTV ? 'tv' : 'movie'}/${movie.id}`, '_blank', 'noopener,noreferrer');
    } finally {
      setLoadingTrailer(false);
    }
  }, [movieDetails, isTV, movie.id]);

  const getTrailerKey = useCallback((details: any): string | null => {
    if (!details?.videos?.results) return null;
    
    let trailer = details.videos.results.find(
      (video: any) => video.type === 'Trailer' && video.site === 'YouTube' && 
      (video.name.toLowerCase().includes('türkçe') || video.name.toLowerCase().includes('turkish'))
    );
    
    if (!trailer) {
      trailer = details.videos.results.find(
        (video: any) => video.type === 'Trailer' && video.site === 'YouTube'
      );
    }
    
    if (!trailer) {
      trailer = details.videos.results.find(
        (video: any) => video.type === 'Teaser' && video.site === 'YouTube'
      );
    }
    
    if (!trailer) {
      trailer = details.videos.results.find(
        (video: any) => video.site === 'YouTube'
      );
    }
    
    return trailer?.key || null;
  }, []);

  const getGenreNames = useCallback((): string => {
    return movie.genre_ids
      ?.map(id => genres.find(g => g.id === id)?.name)
      .filter((name): name is string => Boolean(name))
      .join(', ') || '';
  }, [movie.genre_ids, genres]);

  const getMatchScoreColor = useCallback((score: number): string => {
    if (score >= 90) return 'from-green-500 to-emerald-500';
    if (score >= 80) return 'from-blue-500 to-cyan-500';
    if (score >= 70) return 'from-amber-500 to-orange-500';
    return 'from-orange-500 to-red-500';
  }, []);

  const getMatchScoreIcon = useCallback((score: number) => {
    if (score >= 90) return <Zap className="h-4 w-4" />;
    if (score >= 80) return <Sparkles className="h-4 w-4" />;
    return <Target className="h-4 w-4" />;
  }, []);

  const getReleaseDate = useCallback(() => {
    if (isTV) {
      return (movie as any).first_air_date;
    }
    return (movie as any).release_date;
  }, [isTV, movie]);

  const openYouTubeInNewTab = useCallback((key: string) => {
    const youtubeUrl = `https://www.youtube.com/watch?v=${key}`;
    window.open(youtubeUrl, '_blank', 'noopener,noreferrer');
  }, []);

  // Extract topics from overview and keywords
  const getTopics = useCallback((): string[] => {
    const topics: string[] = [];
    
    // Extract topics from overview using simple keyword matching
    const overview = movie.overview?.toLowerCase() || '';
    const topicKeywords = [
      { keywords: ['aşk', 'sevgi', 'romantik', 'evlilik', 'ilişki', 'sevgili'], topic: 'Aşk & İlişkiler' },
      { keywords: ['savaş', 'asker', 'ordu', 'çatışma', 'saldırı', 'muharebe'], topic: 'Savaş & Çatışma' },
      { keywords: ['aile', 'anne', 'baba', 'çocuk', 'kardeş', 'ebeveyn'], topic: 'Aile & Yakınlık' },
      { keywords: ['suç', 'cinayet', 'polis', 'dedektif', 'soruşturma', 'katil'], topic: 'Suç & Gizem' },
      { keywords: ['okul', 'öğrenci', 'eğitim', 'üniversite', 'öğretmen', 'sınıf'], topic: 'Eğitim & Gençlik' },
      { keywords: ['iş', 'şirket', 'para', 'başarı', 'kariyer', 'patron'], topic: 'İş & Kariyer' },
      { keywords: ['dostluk', 'arkadaş', 'grup', 'takım', 'birlik', 'dost'], topic: 'Dostluk & Takım' },
      { keywords: ['gelecek', 'teknoloji', 'robot', 'uzay', 'bilim', 'yapay'], topic: 'Bilim & Teknoloji' },
      { keywords: ['geçmiş', 'tarih', 'eski', 'dönem', 'antik', 'tarihi'], topic: 'Tarih & Geçmiş' },
      { keywords: ['korku', 'dehşet', 'canavar', 'hayalet', 'kötü', 'korkunç'], topic: 'Korku & Gerilim' },
      { keywords: ['komedi', 'komik', 'gülmece', 'eğlence', 'şaka', 'mizah'], topic: 'Komedi & Eğlence' },
      { keywords: ['macera', 'yolculuk', 'keşif', 'serüven', 'arayış', 'gezi'], topic: 'Macera & Keşif' },
      { keywords: ['büyü', 'sihir', 'fantastik', 'ejder', 'büyücü', 'büyülü'], topic: 'Fantastik & Büyü' },
      { keywords: ['müzik', 'şarkı', 'dans', 'konser', 'sanat', 'müzisyen'], topic: 'Müzik & Sanat' },
      { keywords: ['spor', 'yarış', 'rekabet', 'şampiyon', 'takım', 'oyun'], topic: 'Spor & Rekabet' }
    ];

    for (const { keywords, topic } of topicKeywords) {
      if (keywords.some(keyword => overview.includes(keyword))) {
        topics.push(topic);
      }
    }

    // Add genre-based topics if no overview topics found
    if (topics.length === 0) {
      const genreTopics = movie.genre_ids?.slice(0, 2).map(genreId => {
        const genre = genres.find(g => g.id === genreId);
        return genre?.name;
      }).filter((name): name is string => Boolean(name)) || [];
      
      topics.push(...genreTopics);
    }

    return topics.slice(0, 3); // Max 3 topics
  }, [movie.overview, movie.genre_ids, genres]);

  // Demografik faktörleri hesapla
  const getDemographicFactors = useCallback((): string[] => {
    const factors: string[] = [];
    
    // Bu fonksiyon profil bilgilerini props olarak alacak şekilde genişletilebilir
    // Şimdilik genel faktörler gösteriyoruz
    
    // Yaş bazlı faktörler
    const releaseDate = getReleaseDate();
    if (releaseDate) {
      const year = new Date(releaseDate).getFullYear();
      const currentYear = new Date().getFullYear();
      const age = currentYear - year;
      
      if (age <= 5) {
        factors.push('🎬 Güncel yapım');
      } else if (age <= 15) {
        factors.push('📺 Modern klasik');
      } else if (age >= 25) {
        factors.push('🏛️ Nostaljik klasik');
      }
    }
    
    // Tür bazlı demografik faktörler
    const contentGenres = movie.genre_ids || [];
    if (contentGenres.includes(10751)) {
      factors.push('👨‍👩‍👧‍👦 Aile dostu');
    }
    if (contentGenres.includes(10749)) {
      factors.push('💕 Romantik');
    }
    if (contentGenres.includes(28)) {
      factors.push('💥 Aksiyon dolu');
    }
    if (contentGenres.includes(35)) {
      factors.push('😄 Komik');
    }
    if (contentGenres.includes(18)) {
      factors.push('🎭 Dramatik');
    }
    if (contentGenres.includes(878)) {
      factors.push('🚀 Bilim kurgu');
    }
    
    return factors.slice(0, 3); // Max 3 faktör
  }, [movie.genre_ids, getReleaseDate]);

  // Get cast, directors, and writers from details
  const getCastAndCrew = () => {
    if (!movieDetails?.credits) return { cast: [], directors: [], writers: [] };

    const cast = movieDetails.credits.cast?.slice(0, 6) || [];
    const directors = movieDetails.credits.crew?.filter((member: any) => member.job === 'Director') || [];
    const writers = movieDetails.credits.crew?.filter((member: any) => 
      member.job === 'Writer' || 
      member.job === 'Screenplay' || 
      member.job === 'Story' ||
      member.job === 'Novel' ||
      member.job === 'Creator' ||
      (member.job && member.job.toLowerCase().includes('writ'))
    ) || [];

    return { cast, directors, writers };
  };

  // Kullanıcının bu içeriği nasıl değerlendirdiğini kontrol et

  const isNotInterested = userRating === 'not_interested';
  const isSkipped = userRating === 'skip';

  const hasAnyRating = userRating !== null && userRating !== undefined;



  const topics = getTopics();
  const { cast, directors, writers } = getCastAndCrew();

  return (
    <>
      <div 
        className={`group relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] border-2 ${
          isNotInterested ? 'border-red-500/50 opacity-60' : 
          isSkipped ? 'border-orange-500/50 opacity-70' : 
          'border-amber-500/30'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Match Score Badge */}
        {showMatchScore !== false && (
          <div className="absolute top-4 left-4 z-20">
            <div className={`bg-gradient-to-r ${getMatchScoreColor(matchScore)} rounded-xl px-3 py-2 shadow-lg border border-white/20`}>
              <div className="flex items-center space-x-2 text-white">
                {getMatchScoreIcon(matchScore)}
                <span className="text-sm font-bold">%{Math.round(matchScore)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Movie Poster */}
        <div className="relative aspect-[2/3] overflow-hidden">
          <img
            src={tmdbService.getImageUrl(movie.poster_path, 'w500')}
            alt={title}
            className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${
              isNotInterested || isSkipped ? 'grayscale' : ''
            }`}
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/300x450/374151/f8fafc?text=Poster+Yok';
            }}
          />
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
          
          {/* Status Overlay */}
          {(isNotInterested || isSkipped) && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className={`px-4 py-2 rounded-xl text-white font-bold text-lg ${
                isNotInterested ? 'bg-red-500' : 'bg-orange-500'
              }`}>
                {isNotInterested ? 'İstenmiyor' : 'Atlandı'}
              </div>
            </div>
          )}
          
          {/* Hover Overlay */}
          <div className={`absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleTrailerClick}
                  disabled={loadingTrailer}
                  className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-amber-600/50 disabled:to-orange-600/50 text-white px-4 py-2 rounded-xl transition-all duration-200 text-sm font-medium shadow-lg"
                >
                  {loadingTrailer ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Yükleniyor...</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4" />
                      <span>Fragman</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleDetailsClick}
                  disabled={loadingDetails}
                  className="flex items-center space-x-2 bg-slate-700/80 hover:bg-slate-600/80 text-white px-4 py-2 rounded-xl transition-all duration-200 text-sm font-medium shadow-lg backdrop-blur-sm"
                >
                  {loadingDetails ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Yükleniyor...</span>
                    </>
                  ) : (
                    <>
                      <Info className="h-4 w-4" />
                      <span>Detay</span>
                    </>
                  )}
                </button>
                
                {(onAddToWatchlist || onRemoveFromWatchlist) && (
                  <button
                    onClick={isInWatchlist ? onRemoveFromWatchlist : onAddToWatchlist}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-200 text-sm font-medium shadow-lg ${
                      isInWatchlist 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                        : 'bg-slate-700/80 hover:bg-slate-600/80 text-white backdrop-blur-sm'
                    }`}
                  >
                    {isInWatchlist ? (
                      <>
                        <BookMarked className="h-4 w-4" />
                        <span>Listede</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-4 w-4" />
                        <span>Listeye Ekle</span>
                      </>
                    )}
                  </button>
                )}
                
                {/* Skip Button - Only show if not rated */}
                {!hasAnyRating && (
                  <button
                    onClick={() => onRate('skip', movie.media_type || ('name' in movie ? 'tv' : 'movie'))}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-200 text-sm font-medium shadow-lg ${
                      userRating === 'skip'
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white'
                        : 'bg-slate-600/80 hover:bg-slate-600/80 text-white backdrop-blur-sm'
                    }`}
                  >
                    <SkipForward className="h-4 w-4" />
                    <span>Atla</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Rating Badge */}
          <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-xl px-3 py-2 border border-amber-500/30">
            <div className="flex items-center space-x-1 text-amber-400">
              <Star className="h-4 w-4 fill-current" />
              <span className="text-sm font-bold">{movie.vote_average.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Movie Info - KOMPAKT TASARIM */}
        <div className="p-5">
          <h3 className="font-bold text-brand-textLight text-lg mb-2 line-clamp-2 leading-tight">
            {title}
          </h3>
          
          {/* Compact Info Row */}
          <div className="flex items-center space-x-3 text-sm text-slate-400 mb-3">
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>{getReleaseDate() ? new Date(getReleaseDate()).getFullYear() : ''}</span>
            </div>
            <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
            <span className="text-slate-300 text-sm truncate">{getGenreNames()}</span>
            {movie.original_language && (
              <>
                <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                <div className="flex items-center space-x-1">
                  <Tag className="h-3 w-3" />
                  <span className="uppercase font-medium text-xs">{movie.original_language}</span>
                </div>
              </>
            )}
          </div>

          {/* Topics - Kompakt gösterim */}
          {topics.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {topics.map((topic, index) => (
                <span
                  key={index}
                  className="bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border border-cyan-500/25 text-cyan-300 px-2 py-1 rounded-md text-xs font-medium"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}

          {/* Demografik Faktörler */}
          {getDemographicFactors().length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {getDemographicFactors().map((factor, index) => (
                <span
                  key={index}
                  className="bg-gradient-to-r from-purple-500/15 to-pink-500/15 border border-purple-500/25 text-purple-300 px-2 py-1 rounded-md text-xs font-medium"
                >
                  {factor}
                </span>
              ))}
            </div>
          )}

          {/* Why Recommended - Kompakt */}
          {showReasons && reasons && reasons.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <Target className="h-3 w-3 text-amber-400" />
                <span className="text-xs font-bold text-amber-400">Neden önerildi?</span>
              </div>
              <ul className="space-y-1">
                {reasons.slice(0, 2).map((reason, index) => (
                  <li key={index} className="text-xs text-slate-300 flex items-start">
                    <span className="text-amber-400 mr-1 mt-0.5">•</span>
                    <span className="leading-relaxed">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rating Section - 1-10 Sistem */}
          <div className="space-y-3">


            {/* Rating Slider */}
            <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-brand-textLight font-medium text-sm">Puan</span>
                <span className={`text-lg font-bold ${
                  tempRating >= 9 ? 'text-green-400' :
                  tempRating >= 7 ? 'text-amber-400' :
                  tempRating >= 5 ? 'text-orange-400' :
                  tempRating > 0 ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {tempRating}/10
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={tempRating}
                onChange={(e) => {
                  const rating = parseInt(e.target.value);
                  setTempRating(rating);
                }}
                onMouseUp={(e) => {
                  const rating = parseInt((e.target as HTMLInputElement).value);
                  if (rating > 0) {
                    onRate(rating, movie.media_type || ('name' in movie ? 'tv' : 'movie'));
                  }
                }}
                onTouchEnd={(e) => {
                  const rating = parseInt((e.target as HTMLInputElement).value);
                  if (rating > 0) {
                    onRate(rating, movie.media_type || ('name' in movie ? 'tv' : 'movie'));
                  }
                }}

                className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${(tempRating / 10) * 100}%, #475569 ${(tempRating / 10) * 100}%, #475569 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
                <span>6</span>
                <span>7</span>
                <span>8</span>
                <span>9</span>
                <span>10</span>
              </div>
            </div>



            {/* Status Display */}
            {isSkipped && (
              <div className="text-center">
                <span className="text-xs px-3 py-1 rounded-lg bg-orange-500/20 text-orange-400">
                  Atlandı
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Details Modal with Cast & Crew */}
      {showDetails && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-auto border border-slate-700/50 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
                          <h3 className="text-xl font-bold text-theme-primary">{title}</h3>
            <button
              onClick={() => setShowDetails(false)}
              className="text-slate-400 hover:text-theme-primary text-2xl transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Header Info */}
              <div className="flex items-center space-x-4">
                {showMatchScore !== false && (
                  <div className={`bg-gradient-to-r ${getMatchScoreColor(matchScore)} px-4 py-2 rounded-xl shadow-lg`}>
                    <div className="flex items-center space-x-2 text-white">
                      {getMatchScoreIcon(matchScore)}
                      <span className="font-bold">%{Math.round(matchScore)} Eşleşme</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-2 text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/30">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="font-medium">{movie.vote_average.toFixed(1)}/10</span>
                </div>
              </div>

              {/* Overview */}
              <div>
                <h4 className="text-white font-semibold mb-3 flex items-center space-x-2">
                  <Info className="h-4 w-4 text-blue-400" />
                  <span>Hikaye</span>
                </h4>
                <p className="text-slate-300 leading-relaxed">{movie.overview}</p>
              </div>

              {/* Cast & Crew Section */}
              {movieDetails?.credits && (
                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Main Cast */}
                  {cast.length > 0 && (
                    <div>
                      <h4 className="text-white font-semibold mb-4 flex items-center space-x-2">
                        <Users className="h-4 w-4 text-green-400" />
                        <span>Ana Oyuncu Kadrosu</span>
                      </h4>
                      <div className="space-y-3">
                        {cast.map((actor: any) => (
                          <div key={actor.id} className="flex items-center space-x-3 bg-slate-700/30 rounded-lg p-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-600 flex-shrink-0">
                              {actor.profile_path ? (
                                <img
                                  src={tmdbService.getImageUrl(actor.profile_path, 'w185')}
                                  alt={actor.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Users className="h-6 w-6 text-slate-400" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-theme-primary font-medium text-sm truncate">{actor.name}</p>
                              <p className="text-slate-400 text-xs truncate">{actor.character}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Directors */}
                  {directors.length > 0 && (
                    <div>
                      <h4 className="text-white font-semibold mb-4 flex items-center space-x-2">
                        <Film className="h-4 w-4 text-blue-400" />
                        <span>Yönetmen{directors.length > 1 ? 'ler' : ''}</span>
                      </h4>
                      <div className="space-y-3">
                        {directors.map((director: any) => (
                          <div key={director.id} className="flex items-center space-x-3 bg-slate-700/30 rounded-lg p-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-600 flex-shrink-0">
                              {director.profile_path ? (
                                <img
                                  src={tmdbService.getImageUrl(director.profile_path, 'w185')}
                                  alt={director.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Film className="h-6 w-6 text-slate-400" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-theme-primary font-medium text-sm truncate">{director.name}</p>
                              <p className="text-slate-400 text-xs">Yönetmen</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Writers */}
                  {writers.length > 0 && (
                    <div>
                      <h4 className="text-white font-semibold mb-4 flex items-center space-x-2">
                        <Award className="h-4 w-4 text-purple-400" />
                        <span>Senarist{writers.length > 1 ? 'ler' : ''}</span>
                      </h4>
                      <div className="space-y-3">
                        {writers.slice(0, 6).map((writer: any) => (
                          <div key={`${writer.id}-${writer.job}`} className="flex items-center space-x-3 bg-slate-700/30 rounded-lg p-3">
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-600 flex-shrink-0">
                              {writer.profile_path ? (
                                <img
                                  src={tmdbService.getImageUrl(writer.profile_path, 'w185')}
                                  alt={writer.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Award className="h-6 w-6 text-slate-400" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-theme-primary font-medium text-sm truncate">{writer.name}</p>
                              <p className="text-slate-400 text-xs truncate">{writer.job}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Basic Info */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <span className="text-slate-400 text-sm font-medium">Türler:</span>
                    <span className="text-theme-primary ml-2">{getGenreNames()}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-sm font-medium">Çıkış Tarihi:</span>
                    <span className="text-theme-primary ml-2">{getReleaseDate()}</span>
                  </div>
                  {movieDetails?.runtime && (
                    <div>
                      <span className="text-slate-400 text-sm font-medium">Süre:</span>
                      <span className="text-theme-primary ml-2">{movieDetails.runtime} dakika</span>
                    </div>
                  )}
                  {movieDetails?.number_of_seasons && (
                    <div>
                      <span className="text-slate-400 text-sm font-medium">Sezon Sayısı:</span>
                      <span className="text-theme-primary ml-2">{movieDetails.number_of_seasons}</span>
                    </div>
                  )}
                </div>

                {/* Topics */}
                {topics.length > 0 && (
                  <div>
                    <span className="text-slate-400 text-sm font-medium block mb-2">Konular:</span>
                    <div className="flex flex-wrap gap-2">
                      {topics.map((topic, index) => (
                        <span
                          key={index}
                          className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-300 px-3 py-1 rounded-lg text-sm"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Keywords */}
              {movieDetails?.keywords?.results && movieDetails.keywords.results.length > 0 && (
                <div>
                  <span className="text-slate-400 text-sm font-medium block mb-2">Anahtar Kelimeler:</span>
                  <div className="flex flex-wrap gap-2">
                    {movieDetails.keywords.results.slice(0, 12).map((keyword: any) => (
                      <span
                        key={keyword.id}
                        className="bg-slate-700/50 text-slate-300 px-2 py-1 rounded text-xs"
                      >
                        {keyword.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendation Reasons */}
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4">
                <h4 className="text-white font-semibold mb-3 flex items-center space-x-2">
                  <Target className="h-4 w-4 text-amber-400" />
                  <span>Önerilme Nedenleri</span>
                </h4>
                <ul className="space-y-2">
                  {reasons.map((reason, index) => (
                    <li key={index} className="text-slate-300 text-sm flex items-start">
                      <span className="text-amber-400 mr-2 mt-1">•</span>
                      <span className="leading-relaxed">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});