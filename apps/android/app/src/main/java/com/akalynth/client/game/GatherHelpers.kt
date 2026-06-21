package com.akalynth.client.game

import com.akalynth.client.protocol.GatherNodePublic
import com.akalynth.client.protocol.GatherStationPublic
import com.akalynth.client.protocol.PlayerPublic
import kotlin.math.abs

object GatherHelpers {
    private fun manhattan(ax: Int, ay: Int, bx: Int, by: Int): Int =
        abs(ax - bx) + abs(ay - by)

    fun inRange(me: PlayerPublic?, x: Int, y: Int): Boolean =
        me != null && manhattan(me.x, me.y, x, y) <= 1

    fun nearestGatherableNode(gather: GatherState, me: PlayerPublic?): GatherNodePublic? =
        gather.nodes.values
            .asSequence()
            .filter { it.state == "available" }
            .filter { inRange(me, it.x, it.y) }
            .minByOrNull { manhattan(me!!.x, me.y, it.x, it.y) }

    fun nearestDeliverableStation(gather: GatherState, me: PlayerPublic?): GatherStationPublic? {
        if (gather.heldItemType == null) return null
        return gather.stations.values
            .asSequence()
            .filter { it.kind == "curation" }
            .filter { inRange(me, it.x, it.y) }
            .minByOrNull { manhattan(me!!.x, me.y, it.x, it.y) }
    }

    /** A refined output is prefixed `refined_`; only raw items can be refined. */
    private fun isRefinable(itemType: String?): Boolean =
        itemType != null && !itemType.startsWith("refined_")

    fun nearestRefineryStation(gather: GatherState, me: PlayerPublic?): GatherStationPublic? {
        if (!isRefinable(gather.heldItemType)) return null
        return gather.stations.values
            .asSequence()
            .filter { it.kind == "refinery" }
            .filter { inRange(me, it.x, it.y) }
            .minByOrNull { manhattan(me!!.x, me.y, it.x, it.y) }
    }
}