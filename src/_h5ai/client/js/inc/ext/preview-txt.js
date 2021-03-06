
modulejs.define('ext/preview-txt', ['_', '$', 'markdown', 'core/settings', 'core/event', 'core/resource', 'ext/preview'], function (_, $, markdown, allsettings, event, resource, preview) {

	var settings = _.extend({
			enabled: false,
			types: {}
		}, allsettings['preview-txt']),

		templateText = '<pre id="pv-txt-text" class="highlighted"/>',
		templateMarkdown = '<div id="pv-txt-text" class="markdown"/>',

		// adapted from SyntaxHighlighter
		getHighlightedLines = function (sh, alias, content) {

			var brushes = sh.vars.discoveredBrushes,
				Brush, brush;

			if (!brushes) {
				brushes = {};

				_.each(sh.brushes, function (info, brush) {

					var aliases = info.aliases;

					if (aliases) {
						info.brushName = brush.toLowerCase();

						for (var i = 0; i < aliases.length; i += 1) {
							brushes[aliases[i]] = brush;
						}
					}
				});

				sh.vars.discoveredBrushes = brushes;
			}

			Brush = sh.brushes[brushes[alias || 'plain']];

			if (!Brush) {
				return $();
			}

			brush = new Brush();
			brush.init({toolbar: false, gutter: false});

			return $(brush.getHtml(content)).find('.line');
		},

		preloadText = function (absHref, callback) {

			$.ajax({
					url: absHref,
					dataType: 'text'
				})
				.done(function (content) {

					callback(content);
					// setTimeout(function () { callback(content); }, 1000); // for testing
				})
				.fail(function (jqXHR, textStatus, errorThrown) {

					callback('[ajax error] ' + textStatus);
				});
		},

		onEnter = function (items, idx) {

			var currentItems = items,
				currentIdx = idx,
				currentItem = items[idx],

				onAdjustSize = function () {

					var $content = $('#pv-content'),
						$text = $('#pv-txt-text');

					if ($text.length) {

						$text.height($content.height() - 16);
					}
				},

				onIdxChange = function (rel) {

					currentIdx = (currentIdx + rel + currentItems.length) % currentItems.length;
					currentItem = currentItems[currentIdx];

					var spinnerTimeout = setTimeout(function () { preview.showSpinner(true); }, 200);

					preloadText(currentItem.absHref, function (textContent) {

						clearTimeout(spinnerTimeout);
						preview.showSpinner(false);

						$('#pv-content').fadeOut(100, function () {

							var $text;

							if (settings.types[currentItem.type] === 'none') {

								$text = $(templateMarkdown).text(textContent);

							} else if (settings.types[currentItem.type] === 'fixed') {

								$text = $(templateText).text(textContent);

							} else if (settings.types[currentItem.type] === 'markdown') {

								$text = $(templateMarkdown).html(markdown.toHTML(textContent));
							} else {

								$text = $(templateText).text(textContent);

								resource.ensureSH(function (sh) {

									if (sh) {
										var $table = $('<table/>');

										getHighlightedLines(sh, settings.types[currentItem.type], textContent).each(function (i) {
											$('<tr/>')
												.append($('<td/>').addClass('nr').append(i + 1))
												.append($('<td/>').addClass('line').append(this))
												.appendTo($table);
										});

										$text.empty().append($table);
									}
								});
							}
							$('#pv-content').empty().append($text).fadeIn(200);
							onAdjustSize();

							preview.setIndex(currentIdx + 1, currentItems.length);
							preview.setLabels([
								currentItem.label,
								'' + currentItem.size + ' bytes'
							]);
							preview.setRawLink(currentItem.absHref);
						});
					});
				};

			onIdxChange(0);
			preview.setOnIndexChange(onIdxChange);
			preview.setOnAdjustSize(onAdjustSize);
			preview.enter();
		},

		initItem = function (item) {

			if (item.$view && _.indexOf(_.keys(settings.types), item.type) >= 0) {
				item.$view.find('a').on('click', function (event) {

					event.preventDefault();

					var matchedEntries = _.compact(_.map($('#items .item'), function (item) {

						item = $(item).data('item');
						return _.indexOf(_.keys(settings.types), item.type) >= 0 ? item : null;
					}));

					onEnter(matchedEntries, _.indexOf(matchedEntries, item));
				});
			}
		},

		onLocationChanged = function (item) {

			_.each(item.content, initItem);
		},

		onLocationRefreshed = function (item, added, removed) {

			_.each(added, initItem);
		},

		init = function () {

			if (!settings.enabled) {
				return;
			}

			event.sub('location.changed', onLocationChanged);
			event.sub('location.refreshed', onLocationRefreshed);
		};

	init();
});
