import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_, BytesColumn as BytesColumn_, BooleanColumn as BooleanColumn_, StringColumn as StringColumn_, OneToMany as OneToMany_, Relation as Relation_} from "@subsquid/typeorm-store"
import {ReleaseLog} from "./releaseLog.model"
import {PausedLog} from "./pausedLog.model"

@Entity_()
export class Vesting {
    constructor(props?: Partial<Vesting>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @IntColumn_({nullable: false})
    version!: number

    @BigIntColumn_({nullable: false})
    duration!: bigint

    @BigIntColumn_({nullable: false})
    cliff!: bigint

    @BytesColumn_({nullable: false})
    beneficiary!: Uint8Array

    @BooleanColumn_({nullable: false})
    revoked!: boolean

    @BooleanColumn_({nullable: false})
    revocable!: boolean

    @BigIntColumn_({nullable: false})
    released!: bigint

    @BigIntColumn_({nullable: false})
    start!: bigint

    @BigIntColumn_({nullable: false})
    periodDuration!: bigint

    @StringColumn_({array: true, nullable: false})
    vestedPerPeriod!: (string)[]

    @BooleanColumn_({nullable: false})
    paused!: boolean

    @BooleanColumn_({nullable: false})
    pausable!: boolean

    @BigIntColumn_({nullable: false})
    stop!: bigint

    @BooleanColumn_({nullable: false})
    linear!: boolean

    @BytesColumn_({nullable: false})
    token!: Uint8Array

    @BytesColumn_({nullable: false})
    owner!: Uint8Array

    @BigIntColumn_({nullable: false})
    total!: bigint

    @OneToMany_(() => ReleaseLog, e => e.vesting)
    releaseLogs!: Relation_<ReleaseLog[]>

    @OneToMany_(() => PausedLog, e => e.vesting)
    pausedLogs!: Relation_<PausedLog[]>

    @BigIntColumn_({nullable: true})
    revokeTimestamp!: bigint | undefined | null
}
