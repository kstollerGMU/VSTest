//https://docs.mapbox.com/mapbox-gl-js/example/simple-map/

mapboxgl.accessToken =
  "pk.eyJ1Ijoia3N0b2xsZXJnbXUiLCJhIjoiY2tmbjFrYnk2MXFhODJxcGs4bjYzcTBieSJ9.7lUA-RRAXN4O1KSGsa7ZmQ";

//filtering content
var filterInput = document.getElementById("filter-input");

//create map
var map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/dark-v9",
  center: [-73.81, 40.6755],
  zoom: 5,
  pitch: 0,
  bearing: 0,
  container: "map",
  antialias: true
});

//Comment

fetch(
  "https://kstollergmu.carto.com/api/v2/sql?format=GeoJSON&q=SELECT * FROM ncse_data_georeferenced"
)
  .then(response => {
    return response.json(); //check whether the reply is json
  })
  .then(poi_data => {
    //if promise fulfilled, load all the stuff in the load function
    map.on("load", function() {
      map.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": "#aaa",
          //use an 'interpolate' expression to add a smooth transition effect to the
          //buildings as the user zooms in
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15,
            0,
            15.05,
            ["get", "height"]
          ],
          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15,
            0,
            15.05,
            ["get", "min_height"]
          ],
          "fill-extrusion-opacity": 0.6
        }
      });
      
      //HEATMAP STUFF
      map.addSource("poi-heatmap", {
        data: poi_data,
        type: "geojson"
      });
      //heatmap cluster layer
      var heatmap = map.addLayer({
        id: "poi-heat",
        type: "heatmap",
        source: "poi-heatmap",
        maxzoom: 15,
        layout: {
          visibility: "none"
        },
        paint: {
          //increase intensity as zoom level increases
          "heatmap-intensity": {
            stops: [[11, 1], [15, 3]]
          },
          //assign color values be applied to points depending on their density
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(33,102,172,0)",
            0.2,
            "rgb(103,169,207)",
            0.4,
            "rgb(209,229,240)",
            0.6,
            "rgb(253,219,199)",
            0.8,
            "rgb(239,138,98)",
            1,
            "rgb(178,24,43)"
          ], //increase radius as zoom increases
          "heatmap-radius": {
            stops: [[11, 8], [15, 12]]
          },
          //decrease opacity to transition into the circle layer
          "heatmap-opacity": {
            default: 1,
            stops: [[14, 1], [15, 0]]
           }
         }
       });
      //points that show up at close zoom level
      map.addLayer({
        id: "poi-points",
        type: "circle",
        source: "poi-heatmap",
        minzoom: 14,
        layout: {
          visibility: "none"
        },
        "circle-opacity": {
          stops: [[14, 0], [15, 1]]
        },
        paint: {
          "circle-color": "#11b4da",
          "circle-radius": 6,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff"
        }
      });
      
      
      //CLUSTER STUFF
      //add a new source from our GeoJSON data and set the
      //'cluster' option to true. GL-JS will add the point_count property to your source data.
      map.addSource("poi-clusters", {
        type: "geojson",
        data: poi_data,
        cluster: true,
        clusterMaxZoom: 14, //max zoom to cluster points on
        clusterRadius: 60 //radius of each cluster when clustering points (defaults to 50)
      });

      map.addLayer({
        id: "poi-clusters",
        type: "circle",
        source: "poi-clusters",
        filter: ["has", "point_count"],
        layout: {
          visibility: "visible"
        },
        paint: {
          // Use step expressions (https://www.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
          // with three steps to implement three types of circles:
          // * Blue, 20px circles when point count is less than 100
          // * Yellow, 30px circles when point count is between 100 and 750
          // * Pink, 40px circles when point count is greater than or equal to 750
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#51bbd6",
            250,
            "#f1f075",
            1000,
            "#f28cb1"
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            20,
            250,
            30,
            1000,
            40
          ]
        }
      });

      //this section deals with the number that shows up on cluster
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "poi-clusters",
        filter: ["has", "point_count"],
        layout: {
          visibility: "visible"
        },
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12
        }
      });
      
      //this section deals with the points when they become unclustered
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "poi-clusters",
        filter: ["!", ["has", "point_count"]],
        layout: {
          visibility: "visible"
        },
        paint: {
          "circle-color": "#11b4da",
          "circle-radius": 10,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff"
        }
      });

      //fit map to bounds of data
      var bounds = new mapboxgl.LngLatBounds();
      poi_data.features.forEach(function(feature) {
        bounds.extend(feature.geometry.coordinates);
      });
      map.fitBounds(bounds);
      
      
    
      
      //LAYER CONTROL STUFF - Variables that hold all the elements of each feature
      var clusterLayers = [
        "poi-clusters",  
        "cluster-count",  
        "unclustered-point"
      ]
      
      var heatLayers = [
        "poi-heat",
        "poi-points"
      ];
      
      var layerList = document.getElementById("menu");
      var checkboxes = layerList.getElementsByTagName("input");

      function switchLayer(layer) {
        //get the label of the layer cluster
        var clickedLayersLabel = layer.target.id; 
        //create the variable from the label using the eval function
        var clickedLayers = eval(clickedLayersLabel); 
        // check whether the cluster of layers is visible by checking the first entry
        var visibility = map.getLayoutProperty(clickedLayers[0], "visibility"); 
        if (visibility === "visible") {
          hideLayerGroups(clickedLayers);
        } else {
          showLayerGroups(clickedLayers);
        }
      }
      
      for (var i = 0; i < checkboxes.length; i++) {
        checkboxes[i].onclick = switchLayer;
      }

      function hideLayerGroups(clickedLayers) {
          clickedLayers.forEach(layer => {
            map.setLayoutProperty(layer, "visibility", "none");
          });
       }

      function showLayerGroups(clickedLayers) {
          clickedLayers.forEach(layer => {
            map.setLayoutProperty(layer, "visibility", "visible");
          });
      };
      
      //FILTER STUFF
      var filterInput = document.getElementById("filter-input");
      
      filterInput.addEventListener("keypress", function(e) {
        //if the input value matches a layerID set
        //it's visibility to 'visible' or else hide it.
        var key = e.which || e.keyCode;
        if (key === 13) {
          //13 is enter - if key is enter key, read out value of text field
          var term = e.target.value.trim().toLowerCase();
          console.log(term);

          var filteredFeatures = poi_data.features.filter(function(feature) {
            //null check because not every entry has a value, got an error otherwise
            if (feature.properties.key_words_word_density != null) {
              return feature.properties.key_words_word_density.toLowerCase().includes(term); 
            }              
          });
          var filteredFeatureCollection = {
            type: "FeatureCollection",
            features: filteredFeatures
          };
          map.getSource("poi-clusters").setData(filteredFeatureCollection);
          map.getSource("poi-heatmap").setData(filteredFeatureCollection);
        }
      }); //filterInput
      
      //POPUP STUFF
      var popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
      });

      // single location markers
      // See also https://docs.mapbox.com/mapbox-gl-js/example/popup-on-hover/
      map.on("mouseenter", "unclustered-point", function(e) {
        // Change the cursor style as a UI indicator.
        map.getCanvas().style.cursor = "pointer";

        var coordinates = e.features[0].geometry.coordinates.slice();
        var description = e.features[0].properties.member_university;
    
        
        // Ensure that if the map is zoomed out such that multiple
        // copies of the feature are visible, the popup appears
        // over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        } 
        // Populate the popup and set its coordinates
        // based on the feature found.
        popup
          .setLngLat(coordinates)
          .setHTML(description)
          .addTo(map);
      });

      map.on("mouseleave", "unclustered-point", function() {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    
    });  
  })
  .catch(err => {
    console.log("Erro loading data: ", err);
  });
