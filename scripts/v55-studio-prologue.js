/* v55 professor studio: the single-file app keeps its internals private, so the
   studio borrows them from window.SDPCore (published by the inline bootstrap). */
var SDPC = window.SDPCore || {};
var DB = SDPC.DB, Speech = SDPC.Speech, UI = SDPC.UI, U = SDPC.U, Lib = SDPC.Lib, Admin = SDPC.Admin,
  Cloud = SDPC.Cloud, CONFIG = SDPC.CONFIG, GUIDE = SDPC.GUIDE || [], Store = SDPC.Store, Screens = SDPC.Screens,
  DEFAULT_WALLPAPER_SRC = SDPC.DEFAULT_WALLPAPER_SRC, BUILD_DATE = SDPC.BUILD_DATE, wordRow = SDPC.wordRow,
  SAMPLE_WORDS = SDPC.SAMPLE_WORDS || [], WORD_BANK = SDPC.WORD_BANK || {}, Dict = SDPC.Dict,
  APP_VERSION = SDPC.APP_VERSION;
window.SDPCoreV53 = SDPC;
window.SDPCoreV55 = SDPC;
window.SDPCoreV54 = SDPC;
