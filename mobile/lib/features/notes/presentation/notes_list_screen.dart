import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:anchor/core/widgets/quill_preview.dart';
import 'package:anchor/core/widgets/app_drawer.dart';
import 'package:anchor/features/tags/presentation/tags_controller.dart';
import 'package:anchor/features/tags/domain/tag.dart';
import 'package:anchor/features/notes/presentation/widgets/note_card.dart';
import 'package:anchor/features/notes/presentation/widgets/selection_app_bar_actions.dart';
import 'package:anchor/features/notes/presentation/widgets/empty_states.dart';
import 'package:anchor/features/notes/domain/note.dart';
import 'notes_controller.dart';
import 'notes_view_options.dart';
import 'widgets/view_options_sheet.dart';

class NotesListScreen extends ConsumerStatefulWidget {
  const NotesListScreen({super.key});

  @override
  ConsumerState<NotesListScreen> createState() => _NotesListScreenState();
}

class _NotesListScreenState extends ConsumerState<NotesListScreen>
    with WidgetsBindingObserver {
  final _searchController = TextEditingController();
  Timer? _syncTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startSyncTimer();
    // Sync controller with provider state if it exists
    final currentQuery = ref.read(searchQueryProvider);
    if (currentQuery.isNotEmpty) {
      _searchController.text = currentQuery;
    }
  }

  @override
  void dispose() {
    _syncTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _searchController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // Sync immediately when returning to foreground, then restart timer
      _onRefresh();
      _startSyncTimer();
    } else if (state == AppLifecycleState.paused) {
      _syncTimer?.cancel();
    }
  }

  void _startSyncTimer() {
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) _onRefresh();
    });
  }

  void _exitSelectionMode() {
    ref.read(selectionModeProvider.notifier).setEnabled(false);
    ref.read(selectedNoteIdsProvider.notifier).clear();
  }

  Future<void> _onRefresh() async {
    await ref.read(notesControllerProvider.notifier).sync();
    ref.read(tagsControllerProvider.notifier).sync();
  }

  Widget _buildNoteItem(
    Note note,
    bool isSelectionMode,
    Set<String> selectedNoteIds,
  ) {
    return NoteCard(
      note: note,
      isSelectionMode: isSelectionMode,
      isSelected: selectedNoteIds.contains(note.id),
      onLongPress: () {
        if (!isSelectionMode) {
          ref.read(selectionModeProvider.notifier).setEnabled(true);
        }
        ref.read(selectedNoteIdsProvider.notifier).toggle(note.id);
      },
      onTap: () {
        if (isSelectionMode) {
          ref.read(selectedNoteIdsProvider.notifier).toggle(note.id);
        } else {
          context.go('/note/${note.id}', extra: note);
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final notesAsync = ref.watch(notesControllerProvider);
    final searchQuery = ref.watch(searchQueryProvider);
    final selectedTagId = ref.watch(selectedTagFilterProvider);
    final tagsAsync = ref.watch(tagsControllerProvider);
    final isSyncing = ref.watch(syncingStateProvider);
    final isSelectionMode = ref.watch(selectionModeProvider);
    final selectedNoteIds = ref.watch(selectedNoteIdsProvider);
    final viewOptionsAsync = ref.watch(notesViewOptionsProvider);
    final viewOptions = viewOptionsAsync.value;
    final theme = Theme.of(context);

    // Get selected tag
    Tag? selectedTag;
    if (selectedTagId != null && tagsAsync.hasValue) {
      selectedTag = tagsAsync.value
          ?.where((t) => t.id == selectedTagId)
          .firstOrNull;
    }

    return PopScope(
      canPop: !isSelectionMode,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && isSelectionMode) {
          _exitSelectionMode();
        }
      },
      child: Scaffold(
        drawer: const AppDrawer(),
        bottomNavigationBar: _SyncDebugBar(),
        body: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Theme.of(context).colorScheme.surface,
                Theme.of(
                  context,
                ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
              ],
            ),
          ),
          child: RefreshIndicator(
            onRefresh: _onRefresh,
            displacement: 20,
            edgeOffset: 120, // Position below the pinned app bar
            color: theme.colorScheme.primary,
            child: CustomScrollView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverAppBar(
                  backgroundColor: theme.colorScheme.surface.withValues(
                    alpha: 0.9,
                  ),
                  floating: true,
                  pinned: true,
                  expandedHeight: isSelectionMode ? 56 : 80,
                  toolbarHeight: 56,
                  scrolledUnderElevation: 0,
                  leading: isSelectionMode
                      ? IconButton(
                          icon: const Icon(LucideIcons.x),
                          onPressed: _exitSelectionMode,
                          tooltip: 'Cancel',
                        )
                      : Builder(
                          builder: (context) => IconButton(
                            icon: const Icon(LucideIcons.menu),
                            onPressed: () => Scaffold.of(context).openDrawer(),
                            tooltip: 'Menu',
                          ),
                        ),
                  flexibleSpace: isSelectionMode
                      ? null
                      : FlexibleSpaceBar(
                          titlePadding: const EdgeInsets.only(
                            left: 56,
                            bottom: 16,
                          ),
                          title: Text(
                            'Anchor',
                            style: theme.textTheme.headlineMedium?.copyWith(
                              color: theme.colorScheme.primary,
                              fontWeight: FontWeight.bold,
                              letterSpacing: -0.5,
                            ),
                          ),
                        ),
                  title: isSelectionMode
                      ? Text(
                          selectedNoteIds.isEmpty
                              ? 'Select notes'
                              : '${selectedNoteIds.length} ${selectedNoteIds.length == 1 ? 'note' : 'notes'}',
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: theme.colorScheme.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        )
                      : null,
                  actions: [
                    if (isSelectionMode)
                      SelectionAppBarActions(
                        selectedNoteIds: selectedNoteIds,
                        onExitSelectionMode: _exitSelectionMode,
                      )
                    else ...[
                      // Only show sync indicator when actively syncing
                      if (isSyncing)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: Center(child: _SyncIndicator(theme: theme)),
                        ),
                      if (viewOptions != null)
                        IconButton(
                          icon: Icon(
                            viewOptions.viewType == ViewType.grid
                                ? LucideIcons.layoutGrid
                                : LucideIcons.list,
                          ),
                          tooltip: 'View options',
                          onPressed: () {
                            showModalBottomSheet(
                              context: context,
                              builder: (context) => const ViewOptionsSheet(),
                              useSafeArea: true,
                              isScrollControlled: true,
                            );
                          },
                        ),
                    ],
                  ],
                ),
                SliverPadding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  sliver: SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SearchBar(
                          controller: _searchController,
                          elevation: WidgetStateProperty.all(0),
                          backgroundColor: WidgetStateProperty.all(
                            Theme.of(context)
                                .colorScheme
                                .surfaceContainerHighest
                                .withValues(alpha: 0.5),
                          ),
                          hintText: 'Search your thoughts...',
                          leading: const Icon(LucideIcons.search),
                          trailing: [
                            if (searchQuery.isNotEmpty)
                              IconButton(
                                icon: const Icon(LucideIcons.x),
                                onPressed: () {
                                  _searchController.clear();
                                  ref
                                      .read(searchQueryProvider.notifier)
                                      .set('');
                                },
                              ),
                          ],
                          shape: WidgetStateProperty.all(
                            RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          onChanged: (value) {
                            ref.read(searchQueryProvider.notifier).set(value);
                          },
                        ),
                        // Tag chips for quick filtering
                        if (tagsAsync.hasValue &&
                            tagsAsync.value != null &&
                            tagsAsync.value!.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          SizedBox(
                            height: 36,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: tagsAsync.value!.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(width: 8),
                              itemBuilder: (context, index) {
                                final tag = tagsAsync.value![index];
                                final isSelected = selectedTagId == tag.id;
                                final tagColor = parseTagColor(
                                  tag.color,
                                  fallback: theme.colorScheme.primary,
                                );
                                return FilterChip(
                                  selected: isSelected,
                                  label: Text(tag.name),
                                  avatar: Icon(
                                    LucideIcons.hash,
                                    size: 14,
                                    color: isSelected
                                        ? tagColor
                                        : tagColor.withValues(alpha: 0.7),
                                  ),
                                  labelStyle: TextStyle(
                                    fontSize: 13,
                                    color: isSelected
                                        ? tagColor
                                        : theme.colorScheme.onSurface
                                            .withValues(alpha: 0.7),
                                    fontWeight: isSelected
                                        ? FontWeight.w600
                                        : FontWeight.normal,
                                  ),
                                  selectedColor:
                                      tagColor.withValues(alpha: 0.15),
                                  backgroundColor: theme
                                      .colorScheme.surfaceContainerHighest
                                      .withValues(alpha: 0.5),
                                  side: BorderSide(
                                    color: isSelected
                                        ? tagColor.withValues(alpha: 0.3)
                                        : Colors.transparent,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  showCheckmark: false,
                                  materialTapTargetSize:
                                      MaterialTapTargetSize.shrinkWrap,
                                  visualDensity: VisualDensity.compact,
                                  onSelected: (_) {
                                    if (isSelected) {
                                      ref
                                          .read(selectedTagFilterProvider
                                              .notifier)
                                          .clear();
                                    } else {
                                      ref
                                          .read(selectedTagFilterProvider
                                              .notifier)
                                          .select(tag.id);
                                    }
                                  },
                                );
                              },
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                notesAsync.when(
                  data: (notes) {
                    final filteredNotes = notes.where((note) {
                      if (searchQuery.isEmpty) return true;
                      final q = searchQuery.toLowerCase();
                      final contentText = extractPlainTextFromQuillContent(
                        note.content,
                      ).toLowerCase();
                      return note.title.toLowerCase().contains(q) ||
                          contentText.contains(q);
                    }).toList();

                    if (filteredNotes.isEmpty) {
                      if (searchQuery.isNotEmpty) {
                        return const EmptySearchState();
                      }
                      return const EmptyNotesState();
                    }

                    if (viewOptions == null) {
                      return const SliverToBoxAdapter(child: SizedBox.shrink());
                    }

                    // Apply sorting
                    filteredNotes.sort((a, b) {
                      // Pinned notes stay on top regardless of sort.
                      if (a.isPinned != b.isPinned) {
                        return a.isPinned ? -1 : 1;
                      }

                      int compare;
                      switch (viewOptions.sortOption) {
                        case SortOption.dateModified:
                          compare = (a.updatedAt ?? DateTime(0)).compareTo(
                            b.updatedAt ?? DateTime(0),
                          );
                          break;
                        case SortOption.title:
                          compare = a.title.toLowerCase().compareTo(
                            b.title.toLowerCase(),
                          );
                          break;
                      }
                      return viewOptions.isAscending ? compare : -compare;
                    });

                    return SliverPadding(
                      padding: const EdgeInsets.all(16),
                      sliver: viewOptions.viewType == ViewType.grid
                          ? SliverMasonryGrid.count(
                              crossAxisCount: 2,
                              mainAxisSpacing: 16,
                              crossAxisSpacing: 16,
                              childCount: filteredNotes.length,
                              itemBuilder: (context, index) {
                                return _buildNoteItem(
                                  filteredNotes[index],
                                  isSelectionMode,
                                  selectedNoteIds,
                                );
                              },
                            )
                          : SliverList(
                              delegate: SliverChildBuilderDelegate((
                                context,
                                index,
                              ) {
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 16),
                                  child: _buildNoteItem(
                                    filteredNotes[index],
                                    isSelectionMode,
                                    selectedNoteIds,
                                  ),
                                );
                              }, childCount: filteredNotes.length),
                            ),
                    );
                  },
                  loading: () => const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (err, stack) => SliverFillRemaining(
                    child: Center(child: Text('Error: $err')),
                  ),
                ),
              ],
            ),
          ),
        ),
        floatingActionButton: isSelectionMode
            ? null
            : FloatingActionButton.extended(
                onPressed: () => context.go('/note/new'),
                icon: const Icon(LucideIcons.plus),
                label: const Text('New Note'),
              ),
      ),
    );
  }
}

class _TagFilterChip extends StatelessWidget {
  final Tag tag;
  final VoidCallback onClear;

  const _TagFilterChip({required this.tag, required this.onClear});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tagColor = parseTagColor(
      tag.color,
      fallback: theme.colorScheme.primary,
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
      decoration: BoxDecoration(
        color: tagColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tagColor.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(LucideIcons.filter, size: 14, color: tagColor),
                const SizedBox(width: 6),
                Text(
                  'Filtering by',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                  ),
                ),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: tagColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.hash, size: 12, color: tagColor),
                      const SizedBox(width: 2),
                      Text(
                        tag.name,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: tagColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            child: InkWell(
              onTap: onClear,
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Icon(
                  LucideIcons.x,
                  size: 16,
                  color: theme.colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SyncIndicator extends StatefulWidget {
  final ThemeData theme;

  const _SyncIndicator({required this.theme});

  @override
  State<_SyncIndicator> createState() => _SyncIndicatorState();
}

class _SyncIndicatorState extends State<_SyncIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _rotation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat();

    _rotation = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.linear));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RotationTransition(
      turns: _rotation,
      child: Icon(
        LucideIcons.refreshCw,
        size: 20,
        color: widget.theme.colorScheme.onSurface,
      ),
    );
  }
}

class _SyncDebugBar extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final syncDebug = ref.watch(syncDebugInfoProvider);
    final isSyncing = ref.watch(syncingStateProvider);
    final theme = Theme.of(context);

    String statusText;
    Color statusColor;

    if (isSyncing) {
      statusText = 'Syncing...';
      statusColor = theme.colorScheme.primary;
    } else if (syncDebug.lastError != null) {
      statusText = 'ERR: ${syncDebug.lastError!.length > 50 ? '${syncDebug.lastError!.substring(0, 50)}...' : syncDebug.lastError}';
      statusColor = theme.colorScheme.error;
    } else if (syncDebug.lastSuccessAt != null) {
      final ago = DateTime.now().difference(syncDebug.lastSuccessAt!);
      final agoText = ago.inSeconds < 60
          ? '${ago.inSeconds}s ago'
          : ago.inMinutes < 60
              ? '${ago.inMinutes}m ago'
              : '${ago.inHours}h ago';
      final serverWinsStr = syncDebug.lastServerWins > 0 ? ' ✗${syncDebug.lastServerWins}' : '';
      statusText = '$agoText (↑${syncDebug.lastPushed}$serverWinsStr)';
      statusColor = syncDebug.lastServerWins > 0 ? Colors.orange : Colors.green;
    } else {
      statusText = 'Not synced yet';
      statusColor = theme.colorScheme.onSurface.withValues(alpha: 0.4);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Icon(
              isSyncing
                  ? LucideIcons.refreshCw
                  : syncDebug.lastError != null
                      ? LucideIcons.alertCircle
                      : LucideIcons.checkCircle2,
              size: 12,
              color: statusColor,
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                statusText,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: statusColor,
                  fontFamily: 'monospace',
                  fontSize: 10,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(
              '↑${syncDebug.totalPushed} ↓${syncDebug.totalPulled} ✗${syncDebug.totalServerWins} #${syncDebug.successCount}',
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
                fontFamily: 'monospace',
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
