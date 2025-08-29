var conus = ee.FeatureCollection("TIGER/2016/States"),
    modusGlobal = ee.ImageCollection("MODIS/061/MYD11A2"),
    pekel_monthly_water = ee.ImageCollection("JRC/GSW1_4/MonthlyHistory"),
    modusVeg = ee.ImageCollection("MODIS/061/MYD13A2"),
    CHILI = ee.Image("CSP/ERGo/1_0/Global/SRTM_CHILI"),
    topoDiversity = ee.Image("CSP/ERGo/1_0/Global/ALOS_topoDiversity"),
    VCF = ee.ImageCollection("MODIS/006/MOD44B"),
    gHM = ee.ImageCollection("CSP/HM/GlobalHumanModification"),
    NLDAS = ee.ImageCollection("NASA/NLDAS/FORA0125_H002"),
    pekel_static_water = ee.ImageCollection("JRC/GSW1_4/MonthlyRecurrence"),
    pikelSurfaceWater = ee.Image("JRC/GSW1_4/GlobalSurfaceWater"),
    lsat_7 = ee.ImageCollection("LANDSAT/LE07/C02/T1_L2"),
    lsat_8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2"),
    lsat_9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2"),
    modis_ndsi = ee.ImageCollection("MODIS/061/MYD10A1"),
    modis = ee.ImageCollection("MODIS/061/MOD09A1");
	
// Note this takes a few hours to export the image, 
// but you only have to do it once per state unless you want to change something
// Once the task is submitted, it will continue running even if you close your browser.
var my_state = 'MN'
var study_geo = conus.filter(ee.Filter.eq("STUSPS", my_state)).geometry()

// User Defined Variables
var start_year = 2003 
var end_year = 2024
var years = ee.List.sequence(start_year, end_year);
var start_date_ymd = ee.Date('2003-01-01')
var end_date_ymd = ee.Date('2024-12-31')

var my_scale = 1000
//////////////////////////////////////////////////////////////////////
// Just in case there is missing data
var fill_func = function(img_to_fill){
  var inverse = img_to_fill.unmask().not().gt(0).selfMask()
  var connected = inverse.connectedComponents({
  connectedness: ee.Kernel.plus(1),
  maxSize: 100
})
var connected_size = connected.select([connected.bandNames().get(0)])
  .connectedPixelCount({
    maxSize: 100, 
    eightConnected: false 
})
var connected_area = ee.Image.pixelArea()
                              .addBands(connected_size)
                              .lte(150000)
                              .gt(0)
                              .selfMask()
                              .select('labels')
  
var fill = img_to_fill.focalMax(1,'square','pixels',10)
                            .updateMask(connected_area)
                            .selfMask()

return img_to_fill.addBands(fill)
  .reduce(ee.Reducer.max()).regexpRename('max','filled')
}
/////////////////////////////////////////////////////////////////////
var NLDAS_precip = NLDAS.select("total_precipitation");
var sw_occurrence = pekel_static_water.select('monthly_recurrence').mean()
                      .rename(['SurfaceWaterOccurrence'])
                      .unmask()

var srtmChili = CHILI.select("constant").rename('Heat_Insolation');
var topoDiv = topoDiversity.select("constant").rename("Topo_Diversity")

//var elevation = DEM.select('elevation')
var footprint = gHM.select("gHM");

var raw_gHM = footprint.max().rename('gHM')
// Extract the gHM band

// Function to fill missing values using a growing circular kernel
var fillMissing_ghm = function(image, maxDistance) {
  var mask = image.mask().not();  // areas with missing data
  var distance = mask.fastDistanceTransform(30).sqrt();  // estimate distance
  var filled = image.unmask()
                    .reduceNeighborhood({
                      reducer: ee.Reducer.firstNonNull(),
                      kernel: ee.Kernel.circle({radius: maxDistance, units: 'pixels'}),
                      skipMasked: false
                    });
  return image.unmask(filled);
};

// Fill gHM with nearest pixel within 1000 meters (adjust if needed)
var my_gHM = fillMissing_ghm(raw_gHM, 15).rename('gHM');  // 15 pixels ~ 450–500m at Landsat scale

//QC filters
var cloudMask_LST = function(img){
  var quality_LST = img.select(['QC_Day']);
  var clear_LST = quality_LST.bitwiseAnd(3).eq(0) 
                .and(quality_LST.bitwiseAnd(12).eq(0))
    return img.mask(clear_LST)
};   
var LST_QC = modusGlobal.map(cloudMask_LST).select("LST_Day_1km")

var cloudMask_veg = function(img){
  var quality_veg = img.select("SummaryQA")
  var mask_veg = quality_veg.eq(0)
    return img.updateMask(mask_veg)
  
}
var modusVeg_QC = modusVeg.map(cloudMask_veg)
var NDVI = modusVeg_QC.select("NDVI")

var cloudMask_lsat = function(image){
  var quality =image.select(['QA_PIXEL']);
  var clear = quality.bitwiseAnd(1 << 3).eq(0) // cloud shadow
                .and(quality.bitwiseAnd(1 << 5).eq(0)) // cloud
                .and(quality.bitwiseAnd(1 << 4).eq(0)); // snow
  image = image.mask(clear);
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2)
  
  return image.addBands(opticalBands, null, true);
};   

// Convert Modis to Degrees C
var kelvinToCelsius = function(image) {
  var celsius = image
    .multiply(0.02) // Scale factor for MODIS LST
    .subtract(273.15) // Convert from Kelvin to Celsius
    .rename('LST_Day_1km_Celsius'); // Rename the band for clarity
  return image.addBands(celsius); // Add the Celsius band to the image
};
//////////////////////////////////////////////////////////////////
// Greeness
// NDVI
var NDVI_summer = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return modusVeg_QC.select("NDVI")
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(152,243))
        .reduce(ee.Reducer.max())
        .set('year', y);
    })
  );
var greeness_bands = (NDVI_summer.map(fill_func).median()).rename('NDVI')
////////////////////////////////////////////////////////////////
// LST
var LST_annual = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return LST_QC
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .reduce(ee.Reducer.median())
        .set('year', y);
    })
  )
var LST_annual_median = LST_annual.median().rename('LST_Annual')  

var LST_spring = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return LST_QC
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(152,273))
        .reduce(ee.Reducer.median())
        .set('year', y);
    })
  )
var LST_spring_median = (LST_spring.map(fill_func)).median().rename('LST_Spring')  

var LST_summer = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return LST_QC
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(152,243))
        .reduce(ee.Reducer.median())
        .set('year', y);
    })
  )
var LST_summer_median = (LST_summer.map(fill_func)).median().rename('LST_Summer')  

var LST_fall = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return LST_QC
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(244,334))
        .reduce(ee.Reducer.median())
        .set('year', y);
    })
  )
var LST_fall_median = (LST_fall.map(fill_func)).median().rename('LST_Fall')  

var LST_winter = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return LST_QC
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(335,60))
        .reduce(ee.Reducer.median())
        .set('year', y);
    })
  )
var LST_winter_median = (LST_winter.map(fill_func)).median().rename('LST_Winter')  

var LST_bands = LST_annual_median.addBands(LST_summer_median)
        .addBands(LST_winter_median)
        .addBands(LST_spring_median)
        .addBands(LST_fall_median)
/////////////////////////////////////////////////////
// Flashiness etc.
var Flash_yearly_stDev = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return pekel_monthly_water
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .reduce(ee.Reducer.sampleStdDev())
        .set('year', y)
        .rename('Flashiness');
    })
  ).median();

var runoff = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return pekel_monthly_water
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(91,181))
        .reduce(ee.Reducer.max())
        .set('year', y)
        .rename('Runoff');
    })
  ).median();

var drawdown = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return pekel_monthly_water
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(182,243))
        .reduce(ee.Reducer.min())
        .set('year', y)
        .rename('Drawdown');
    })
  ).median();

var water_bands = Flash_yearly_stDev
          .addBands(runoff)
          .addBands(drawdown)
////////////////////////////////////////////////////////////////////
// Precip
var total_precip_spring = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return NLDAS_precip
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(60,151))
        .reduce(ee.Reducer.sum())
        .set('year', y)
        .rename('Precip_Spring');
    })
  ).median();

var total_precip_summer = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return NLDAS_precip
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(152,243))
        .reduce(ee.Reducer.sum())
        .set('year', y)
        .rename('Precip_Summer');
    })
  ).median();

var total_precip_fall = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return NLDAS_precip
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(244,334))
        .reduce(ee.Reducer.sum())
        .set('year', y)
        .rename('Precip_Fall');
    })
  ).median();

var total_precip_winter = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return NLDAS_precip
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .filter(ee.Filter.dayOfYear(335,59))
        .reduce(ee.Reducer.sum())
        .set('year', y)
        .rename('Precip_Winter');
    })
  ).median();
  
var precip_bands = total_precip_winter
                        .addBands(total_precip_spring)
                        .addBands(total_precip_summer)
                        .addBands(total_precip_fall)

var static_input_bands = srtmChili.addBands(topoDiv).addBands(my_gHM).addBands(sw_occurrence) 
//////////////////////////////////////////////////////////////////////////
// Normalized Difference predictors (NDBI, NDCI, and NDTI)
var ndbiCalc = function(image) {
  var ndbi = image.normalizedDifference(['SR_B5', 'SR_B4']);
  ndbi = ndbi.select([0], ['ndbi']);
  return ndbi;
};

var ndciCalc = function(image) {
  var ndci = image.normalizedDifference(['SR_B4', 'SR_B3']);
  ndci = ndci.select([0], ['ndci']);
  return ndci;
};

var ndtiCalc = function(image) {
  var ndti = image.normalizedDifference(['SR_B3', 'SR_B2']);
  ndti = ndti.select([0], ['ndti']);
  return ndti;
};
var mndwiCalc = function(image) {
  var mndwi = image.normalizedDifference(['SR_B2', 'SR_B5']);
  mndwi = mndwi.select([0], ['mndwi']);
  return mndwi;
};
var bandRenamel8 = function(image){
  var rename = image.select(['SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7'],
  ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7']); 
  return rename; 
};
//============================================================================
//    create imageCollection - filter landsat l7, l8 (rename bands), and merge 
//============================================================================
var periodl7 = lsat_7
    .filterBounds(study_geo) 
    .filter((ee.Filter.date('2000-01-01', '2012-12-31')))
    .map(cloudMask_lsat);

var periodl8 = lsat_8
    .filterBounds(study_geo)
    .filter((ee.Filter.date('2013-01-01', '2024-12-31')))
    .map(cloudMask_lsat)
    .map(bandRenamel8);

var period = ee.ImageCollection(periodl7, periodl8); 
// //===========================================================
// // filter landsat data
// //===========================================================  
var periodFilter = ee.ImageCollection(period)
  .filterBounds(study_geo) //filter bounds to project area
  .filter((ee.Filter.date(start_date_ymd, end_date_ymd)))//change range of years here
  .filter(ee.Filter.dayOfYear(152,243))//change range of days here
  
// convert imageCollection to mean image and slect bands 
var periodMedian = periodFilter.select('SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B7').median();

var imgNDCI = ndciCalc(periodMedian)


var ndci_filled = fill_func(imgNDCI).rename('NDCI')
var imgNDBI = ndbiCalc(periodMedian)


var ndbi_filled = fill_func(imgNDBI).rename('NDBI')
var imgNDTI = ndtiCalc(periodMedian)


var ndti_filled = fill_func(imgNDTI).rename('NDTI')
var imgMNDWI = ndtiCalc(periodMedian) 
var mndwi_filled = fill_func(imgMNDWI).rename('MNDWI')
var NDSI_byYear = ee.ImageCollection.fromImages(
    years.map(function(y) {
      return modis_ndsi.select('NDSI_Snow_Cover')
        .filter(ee.Filter.calendarRange(1, 3, 'month'))
        .filter(ee.Filter.calendarRange(y, y, 'year'))
        .reduce(ee.Reducer.max())
        .set('year', y);
    })
  )
  

var ndsi_filled = (NDSI_byYear.map(fill_func).median()).rename('NDSI')

var nd = ndti_filled.addBands([ndbi_filled, ndci_filled, ndsi_filled, mndwi_filled])

// /////////////////////////////////////////////////////////////////////////////////////////////////
// /// Ice Melt with Modis
// cloudmask functions for various inputs 
// Modis QC
var cloudMask_modis = function(image){
  var quality_modis =image.select(["QA"]);
  // clear = no clouds, coud shadow
  var clear_modis = quality_modis.bitwiseAnd(3).eq(0) // cloud shadow
                .and(quality_modis.bitwiseAnd(12).eq(0)) // cloud
  return image.mask(clear_modis);
};  
// This is different from the NDSI predictor created directly from the MODIS NDSI product
//MODIS (band 4 and band 6)
var ndsiCalc_modis = function(image) {
  var ndsi_modis_nd = image.normalizedDifference(['sur_refl_b04', 'sur_refl_b06']);
  var ndsi_modis = ndsi_modis_nd.select([0], ['ndsi_modis']);
  return ndsi_modis;
};
// Create new filter that brackets potential days of the year for ice melt
var periodFilter_melt = ee.ImageCollection(modis)
  .filter((ee.Filter.date(start_date_ymd, end_date_ymd)))//change range of years here
  .filter(ee.Filter.dayOfYear(30,200))//change range of days here
  .map(cloudMask_modis);
// Apply existing NDSI modis function to new range of modis data 
var ndsi_melt = periodFilter_melt.map(function(img) {return img.addBands(ndsiCalc_modis(img)).clip(study_geo)});
var mn_ndsi_melt = ndsi_melt.select('ndsi_modis');
// Function to define NDSI value threshold for melting and mask pixels by threshold
var date2img_melt = function(img){
  var img_melt = ee.Image(img);
  var date_melt = img_melt.date().getRelative('day', 'year'); // date in Day-of-Year format
  var mask_melt = img_melt.lte(0);   // high temperature mask
  return ee.Image(date_melt).toFloat().updateMask(mask_melt);  
};
var my_melt = mn_ndsi_melt.map(date2img_melt).map(fill_func).min().rename('Ice_Melt');  // determine the first day of ice melt
/////////////////////////////////////////////////////////////////////////////////////////////////
/// Ice up with Modis
// Create new filter that brackets potential days of the year for ice melt
var periodFilter_freeze = ee.ImageCollection(modis)
  .filter((ee.Filter.date(start_date_ymd, end_date_ymd)))//change range of years here
  .filter(ee.Filter.dayOfYear(200,365))//change range of days here
  .map(cloudMask_modis);
// Apply existing NDSI modis function to new range of modis data 
var ndsi_freeze = periodFilter_freeze.map(function(img) {return img.addBands(ndsiCalc_modis(img)).clip(study_geo)});
var mn_ndsi_freeze = ndsi_freeze.select('ndsi_modis');
// Function to define NDSI value threshold for melting and mask pixels by threshold
var date2img_freeze = function(img){
  var img_freeze = ee.Image(img);
  var date_freeze = img_freeze.date().getRelative('day', 'year'); // date in Day-of-Year format
  var mask_freeze = img_freeze.gt(0.4);   // high temperature mask
  return ee.Image(date_freeze).toFloat().updateMask(mask_freeze);  
};
var ice_freeze = mn_ndsi_freeze.map(date2img_freeze).map(fill_func).min()
var my_freeze = ice_freeze.rename('Freeze_Up')
var freeze_thaw = my_freeze.addBands(my_melt)
//////////////////////////////////////
var cloudMask_modis2 = function(image){
  var quality_modis =image.select(["QC_Day"]);
  // clear = no clouds, coud shadow
  var clear_modis = quality_modis.bitwiseAnd(3).eq(0) // cloud shadow
                .and(quality_modis.bitwiseAnd(12).eq(0)) // cloud
  return image.mask(clear_modis);
};  
////////////////////////////////////////////////////////
// Convert Modis to Degrees C
var kelvinToCelsius2 = function(image) {
  var celsius = image
    .multiply(0.02) // Scale factor for MODIS LST
    .subtract(273.15) // Convert from Kelvin to Celsius
    .rename('LST_Day_1km_Celsius'); // Rename the band for clarity
  return image.addBands(celsius); // Add the Celsius band to the image
};
// /////////////////////////////////////////////////////////////////////////////////////////////////
// /// Spawn Start
// Create new filter that brackets potential days of the year for ice melt
var periodFilter = ee.ImageCollection(modusGlobal)
  .filter((ee.Filter.date('2003-01-01', '2024-12-31')))//change range of years here
  .map(cloudMask_modis2)
// Apply existing NDSI modis function to new range of modis data 

////////////////////////////////////////////////////////////////////
// spawn start
var modisLST_start = periodFilter.select('LST_Day_1km')
  .filter(ee.Filter.dayOfYear(60,200))//change range of days here

print(modisLST_start)

var modisLST_start_Celsius = modisLST_start.map(kelvinToCelsius2);

var date2img_spawn_start = function(img){
  var img_spawn_start = ee.Image(img);
  var date_spawn_start = img_spawn_start.date().getRelative('day', 'year'); // date in Day-of-Year format
  var mask_spawn_start = img_spawn_start.gt(10)   // high temperature mask
  return ee.Image(date_spawn_start).toFloat().updateMask(mask_spawn_start);  
};
var spawn_start = modisLST_start_Celsius.select("LST_Day_1km_Celsius").map(date2img_spawn_start).min();  // determine the first day of ice melt
print(spawn_start)
////////////////////////////////////////////////////////////////////////////////////
// Spawn End
var modisLST_end = periodFilter.select('LST_Day_1km')
  .filter(ee.Filter.dayOfYear(243,334))//change range of days here

print(modisLST_end)

var modisLST_end_Celsius = modisLST_end.map(kelvinToCelsius2);

var date2img_spawn_end = function(img){
  var img_spawn_end = ee.Image(img);
  var date_spawn_end = img_spawn_end.date().getRelative('day', 'year'); // date in Day-of-Year format
  var mask_spawn_end = img_spawn_end.lt(10)   // high temperature mask
  return ee.Image(date_spawn_end).toFloat().updateMask(mask_spawn_end);  
};
var spawn_end = modisLST_end_Celsius.select("LST_Day_1km_Celsius").map(date2img_spawn_end).min();  // determine the first day of ice melt
print(spawn_end)
////////////////////////////////////////////////////////////////////
var spawn_duration = spawn_end.subtract(spawn_start).rename("Growing_Season_Length")
var my_spawn_end = spawn_end.rename('Growing_Season_End')
var my_spawn_start = spawn_start.rename('Growing_Season_Start')
////////////////////////////////////////////////////////////////////////////////
var modisLST_ideal = periodFilter.select('LST_Day_1km')
  .filter(ee.Filter.dayOfYear(60,334))//change range of days here

print(modisLST_ideal)

var modisLST_ideal_Celsius = modisLST_ideal.map(kelvinToCelsius2);

var date2img_spawn_ideal = function(img){
  var img_spawn_ideal = ee.Image(img);
  var date_spawn_ideal = img_spawn_ideal.date().getRelative('day', 'year'); // date in Day-of-Year format
  var mask_spawn_ideal = img_spawn_ideal.gte(17).and(img_spawn_ideal.lt(25))   // high temperature mask
  return ee.Image(date_spawn_ideal).toFloat().updateMask(mask_spawn_ideal);  
};
var spawn_ideal = modisLST_ideal_Celsius.select("LST_Day_1km_Celsius").map(date2img_spawn_ideal).count();  // determine the first day of ice melt
print(spawn_ideal)


var my_spawn_ideal = spawn_ideal.rename('Growing_Season_Ideal')
var spawning_bands = spawn_duration.addBands([my_spawn_ideal, my_spawn_end,
my_spawn_start])

///////////////////////////////////////////////////////////////////////////////
// Combine into final RSD raster
var env_raster = precip_bands.addBands([water_bands, LST_bands, greeness_bands, static_input_bands, nd, freeze_thaw, spawning_bands]);
// Displaying the map will probably exceed memory, but the export will work.
//Map.addLayer(env_raster.clip(study_geo))
////////////////////////////////////////////////////////////////////////
// Export RSD predictors to your assets
Export.image.toAsset({
  image: env_raster.toFloat(),
  description: 'rsd',
  assetId: 'rsd_' + start_year + "_" + end_year,  // <> modify these
  region: study_geo,
  crs: "EPSG:5070",
  scale: my_scale
});
